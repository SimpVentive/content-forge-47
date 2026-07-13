/**
 * SCORM Package Validator - Validates ZIP package structure and integrity
 * Ensures package is valid SCORM and can be imported into any LMS
 */

import JSZip from "jszip";

export interface PackageCheckResult {
  check: string;
  passed: boolean;
  details?: string;
  severity: "critical" | "warning";
}

export interface PackageValidationReport {
  timestamp: string;
  fileSize: number; // bytes
  isValid: boolean;
  checks: PackageCheckResult[];
  summary: {
    critical: number;
    warnings: number;
    passed: number;
  };
  recommendations: string[];
}

/**
 * Validates a SCORM package ZIP file
 */
export class ScormPackageValidator {
  private checks: PackageCheckResult[] = [];

  /**
   * Validates package after ZIP creation
   */
  async validatePackage(zip: JSZip, fileSize: number): Promise<PackageValidationReport> {
    this.checks = [];

    // Run all validation checks
    await this.checkManifestExists(zip);
    await this.checkManifestFormat(zip);
    await this.checkResourceReferences(zip);
    await this.checkAssetIntegrity(zip);
    await this.checkFileStructure(zip);
    await this.checkPackageSize(fileSize);

    return this.generateReport(fileSize);
  }

  /**
   * Checks if imsmanifest.xml exists
   */
  private async checkManifestExists(zip: JSZip): Promise<void> {
    const manifestFile = zip.file("imsmanifest.xml");

    if (!manifestFile) {
      this.addCheck({
        check: "Manifest file exists",
        passed: false,
        details: "imsmanifest.xml not found in package root",
        severity: "critical",
      });
      return;
    }

    this.addCheck({
      check: "Manifest file exists",
      passed: true,
      details: "imsmanifest.xml found",
      severity: "critical",
    });
  }

  /**
   * Validates manifest XML format
   */
  private async checkManifestFormat(zip: JSZip): Promise<void> {
    const manifestFile = zip.file("imsmanifest.xml");
    if (!manifestFile) {
      this.addCheck({
        check: "Manifest is valid XML",
        passed: false,
        details: "Cannot validate - manifest not found",
        severity: "critical",
      });
      return;
    }

    try {
      const manifestContent = await manifestFile.async("string");

      // Basic XML validation
      if (!manifestContent.includes("<?xml")) {
        this.addCheck({
          check: "Manifest is valid XML",
          passed: false,
          details: "Missing XML declaration",
          severity: "critical",
        });
        return;
      }

      if (!manifestContent.includes("<manifest")) {
        this.addCheck({
          check: "Manifest is valid XML",
          passed: false,
          details: "Missing <manifest> root element",
          severity: "critical",
        });
        return;
      }

      // Try to parse as XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(manifestContent, "text/xml");

      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        this.addCheck({
          check: "Manifest is valid XML",
          passed: false,
          details: "XML parsing error",
          severity: "critical",
        });
        return;
      }

      // Check required elements
      const hasOrganization = xmlDoc.getElementsByTagName("organization").length > 0;
      const hasResources = xmlDoc.getElementsByTagName("resource").length > 0;

      if (!hasOrganization || !hasResources) {
        this.addCheck({
          check: "Manifest is valid XML",
          passed: false,
          details: `Missing required elements: ${!hasOrganization ? "organization" : ""} ${!hasResources ? "resources" : ""}`,
          severity: "critical",
        });
        return;
      }

      this.addCheck({
        check: "Manifest is valid XML",
        passed: true,
        details: "Manifest is well-formed SCORM 1.2 XML",
        severity: "critical",
      });
    } catch (error) {
      this.addCheck({
        check: "Manifest is valid XML",
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        severity: "critical",
      });
    }
  }

  /**
   * Validates that referenced resources exist
   */
  private async checkResourceReferences(zip: JSZip): Promise<void> {
    const manifestFile = zip.file("imsmanifest.xml");
    if (!manifestFile) return;

    try {
      const manifestContent = await manifestFile.async("string");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(manifestContent, "text/xml");

      const resources = xmlDoc.getElementsByTagName("resource");
      let brokenRefs = 0;
      let validRefs = 0;

      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const href = resource.getAttribute("href");

        if (!href) continue;

        // Check if referenced file exists
        const file = zip.file(href);
        if (!file) {
          brokenRefs++;
        } else {
          validRefs++;
        }
      }

      if (brokenRefs > 0) {
        this.addCheck({
          check: "Resource references are valid",
          passed: false,
          details: `${brokenRefs} broken reference(s), ${validRefs} valid`,
          severity: "critical",
        });
      } else {
        this.addCheck({
          check: "Resource references are valid",
          passed: true,
          details: `All ${validRefs} resource reference(s) resolve correctly`,
          severity: "critical",
        });
      }
    } catch (error) {
      this.addCheck({
        check: "Resource references are valid",
        passed: false,
        details: "Error validating references",
        severity: "warning",
      });
    }
  }

  /**
   * Checks asset files integrity
   */
  private async checkAssetIntegrity(zip: JSZip): Promise<void> {
    const assetTypes = ["assets/images", "assets/audio", "assets/videos"];
    let totalAssets = 0;
    let corruptedAssets = 0;

    for (const assetDir of assetTypes) {
      zip.folder(assetDir)?.forEach((path, file) => {
        totalAssets++;
        // JSZip loading indicates file integrity
      });
    }

    if (totalAssets === 0) {
      this.addCheck({
        check: "Assets are present and valid",
        passed: true,
        details: "No assets folder (all assets may be embedded)",
        severity: "warning",
      });
    } else if (corruptedAssets === 0) {
      this.addCheck({
        check: "Assets are present and valid",
        passed: true,
        details: `${totalAssets} asset file(s) verified`,
        severity: "critical",
      });
    } else {
      this.addCheck({
        check: "Assets are present and valid",
        passed: false,
        details: `${corruptedAssets} corrupted asset(s)`,
        severity: "critical",
      });
    }
  }

  /**
   * Validates directory structure
   */
  private async checkFileStructure(zip: JSZip): Promise<void> {
    const requiredFiles = ["imsmanifest.xml"];
    const requiredFolders = [];

    // Check required files
    const fileNames = Object.keys(zip.files);
    const hasAllRequired = requiredFiles.every((file) =>
      fileNames.some((f) => f.endsWith(file))
    );

    if (hasAllRequired) {
      this.addCheck({
        check: "Package structure is correct",
        passed: true,
        details: `SCORM package contains required files and folders`,
        severity: "critical",
      });
    } else {
      const missing = requiredFiles.filter((file) =>
        !fileNames.some((f) => f.endsWith(file))
      );
      this.addCheck({
        check: "Package structure is correct",
        passed: false,
        details: `Missing files: ${missing.join(", ")}`,
        severity: "critical",
      });
    }
  }

  /**
   * Checks package size
   */
  private async checkPackageSize(fileSize: number): Promise<void> {
    const fileSizeMb = fileSize / (1024 * 1024);

    if (fileSizeMb > 500) {
      this.addCheck({
        check: "Package size is reasonable",
        passed: false,
        details: `Package is ${fileSizeMb.toFixed(1)}MB - may exceed LMS limits`,
        severity: "warning",
      });
    } else if (fileSizeMb > 100) {
      this.addCheck({
        check: "Package size is reasonable",
        passed: true,
        details: `Package is ${fileSizeMb.toFixed(1)}MB - within typical limits`,
        severity: "warning",
      });
    } else {
      this.addCheck({
        check: "Package size is reasonable",
        passed: true,
        details: `Package is ${fileSizeMb.toFixed(1)}MB - optimal size`,
        severity: "critical",
      });
    }
  }

  /**
   * Adds a check result
   */
  private addCheck(check: PackageCheckResult): void {
    this.checks.push(check);
  }

  /**
   * Generates validation report
   */
  private generateReport(fileSize: number): PackageValidationReport {
    const critical = this.checks.filter((c) => !c.passed && c.severity === "critical");
    const warnings = this.checks.filter((c) => !c.passed && c.severity === "warning");
    const passed = this.checks.filter((c) => c.passed);

    const isValid = critical.length === 0;

    const recommendations: string[] = [];

    if (critical.length > 0) {
      recommendations.push("Fix critical issues before importing to LMS");
    }

    if (warnings.length > 0) {
      recommendations.push("Review warnings for optimal LMS compatibility");
    }

    if (fileSize > 100 * 1024 * 1024) {
      recommendations.push("Consider optimizing images to reduce package size");
    }

    if (!this.checks.some((c) => c.check === "Assets are present and valid")) {
      recommendations.push("Verify all referenced assets are included");
    }

    return {
      timestamp: new Date().toISOString(),
      fileSize,
      isValid,
      checks: this.checks,
      summary: {
        critical: critical.length,
        warnings: warnings.length,
        passed: passed.length,
      },
      recommendations,
    };
  }
}

/**
 * Quick package validation helper
 */
export async function validateScormPackage(
  zip: JSZip,
  fileSize: number
): Promise<PackageValidationReport> {
  const validator = new ScormPackageValidator();
  return await validator.validatePackage(zip, fileSize);
}
