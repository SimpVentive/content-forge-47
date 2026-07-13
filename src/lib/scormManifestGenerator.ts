/**
 * SCORM Manifest Generator - Creates imsmanifest.xml for SCORM packages
 * Generates SCORM 1.2 compliant manifest with proper structure and metadata
 */

export interface ManifestMetadata {
  courseId: string;
  courseTitle: string;
  courseDescription?: string;
  courseVersion?: string;
  author?: string;
  createdDate: Date;
  modifiedDate: Date;
  duration?: string; // ISO 8601 format, e.g., PT45M
  maxScore?: number;
  passingScore?: number;
}

export interface ManifestOrganization {
  title: string;
  items: Array<{
    identifier: string;
    title: string;
    resourceId: string;
    duration?: string;
  }>;
}

export interface ManifestResource {
  id: string;
  type: string;
  href: string;
  scormType: "sco" | "asset";
  files?: Array<{ href: string }>;
  parameters?: Record<string, string>;
}

/**
 * Generates SCORM 1.2 imsmanifest.xml content
 */
export class ScormManifestGenerator {
  private metadata: ManifestMetadata;
  private organization: ManifestOrganization;
  private resources: ManifestResource[] = [];

  constructor(metadata: ManifestMetadata, organization: ManifestOrganization) {
    this.metadata = metadata;
    this.organization = organization;
  }

  /**
   * Adds a resource to the manifest
   */
  addResource(resource: ManifestResource): void {
    this.resources.push(resource);
  }

  /**
   * Generates complete imsmanifest.xml content
   */
  generate(): string {
    const xml: string[] = [];

    // XML declaration
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');

    // Root manifest element
    xml.push(
      '<manifest identifier="' +
        escapeXml(this.metadata.courseId) +
        '" version="1.0" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" ' +
        'xmlns:adlcp="http://www.adlnet.org/xsd/adl_cp_v1_2" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
        'xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 ' +
        'http://www.imsglobal.org/xsd/imscp_v1p1/imscp_v1p1.xsd ' +
        'http://www.adlnet.org/xsd/adl_cp_v1_2 ' +
        'http://www.adlnet.org/xsd/adl_cp_v1_2/adlcp_v1p2.xsd">'
    );

    // Metadata
    xml.push(this.generateMetadata());

    // Organizations
    xml.push(this.generateOrganizations());

    // Resources
    xml.push(this.generateResources());

    // Close manifest
    xml.push("</manifest>");

    return xml.join("\n");
  }

  /**
   * Generates metadata section
   */
  private generateMetadata(): string {
    const lines: string[] = [];
    const isoDate = this.metadata.createdDate.toISOString();

    lines.push("  <metadata>");
    lines.push("    <schema>ADL SCORM</schema>");
    lines.push("    <schemaversion>1.2</schemaversion>");

    // LOM metadata
    lines.push("    <lom xmlns:lom='http://ltsc.ieee.org/xsd/LOM'>");

    // General
    lines.push("      <lom:general>");
    lines.push(
      "        <lom:title><lom:string language='en'>" +
        escapeXml(this.metadata.courseTitle) +
        "</lom:string></lom:title>"
    );

    if (this.metadata.courseDescription) {
      lines.push(
        "        <lom:description><lom:string language='en'>" +
          escapeXml(this.metadata.courseDescription) +
          "</lom:string></lom:description>"
      );
    }

    lines.push(
      "        <lom:language>en</lom:language>" +
        "      </lom:general>"
    );

    // LifeCycle
    lines.push("      <lom:lifeCycle>");
    lines.push(
      "        <lom:version><lom:string>" +
        escapeXml(this.metadata.courseVersion || "1.0") +
        "</lom:string></lom:version>"
    );

    lines.push(
      "        <lom:contribute>" +
        "          <lom:role><lom:source>LOMv1.0</lom:source><lom:value>creator</lom:value></lom:role>" +
        "          <lom:entity>Content Forge</lom:entity>" +
        `          <lom:date><lom:dateTime>${isoDate}</lom:dateTime></lom:date>` +
        "        </lom:contribute>"
    );
    lines.push("      </lom:lifeCycle>");

    // Educational
    lines.push("      <lom:educational>");
    lines.push(
      "        <lom:learningResourceType><lom:value>course</lom:value></lom:learningResourceType>" +
        "        <lom:learningTime><lom:duration>" +
        escapeXml(this.metadata.duration || "PT1H") +
        "</lom:duration></lom:learningTime>" +
        "      </lom:educational>"
    );

    lines.push("    </lom>");
    lines.push("  </metadata>");

    return lines.join("\n");
  }

  /**
   * Generates organizations section
   */
  private generateOrganizations(): string {
    const lines: string[] = [];

    lines.push("  <organizations default='org1'>");
    lines.push(
      "    <organization identifier='org1' structure='hierarchical'>"
    );
    lines.push(
      "      <title>" + escapeXml(this.organization.title) + "</title>"
    );

    // Add items as organization structure
    this.organization.items.forEach((item, index) => {
      lines.push(
        `      <item identifier='${escapeXml(item.identifier)}' ` +
          `identifierref='${escapeXml(item.resourceId)}' isvisible='true'>`
      );
      lines.push(`        <title>${escapeXml(item.title)}</title>`);

      if (item.duration) {
        lines.push(
          `        <adlcp:duration>${escapeXml(item.duration)}</adlcp:duration>`
        );
      }

      lines.push("      </item>");
    });

    lines.push("    </organization>");
    lines.push("  </organizations>");

    return lines.join("\n");
  }

  /**
   * Generates resources section
   */
  private generateResources(): string {
    const lines: string[] = [];

    lines.push("  <resources>");

    this.resources.forEach((resource) => {
      const attrs = [
        `identifier='${escapeXml(resource.id)}'`,
        `type='${escapeXml(resource.type)}'`,
        `adlcp:scormtype='${escapeXml(resource.scormType)}'`,
        `href='${escapeXml(resource.href)}'`,
      ];

      lines.push(`    <resource ${attrs.join(" ")}>`);

      // Add file references
      if (resource.files && resource.files.length > 0) {
        resource.files.forEach((file) => {
          lines.push(`      <file href='${escapeXml(file.href)}'/>`);
        });
      }

      // Add parameters if any
      if (resource.parameters && Object.keys(resource.parameters).length > 0) {
        for (const [key, value] of Object.entries(resource.parameters)) {
          lines.push(
            `      <adlcp:parameter name='${escapeXml(key)}'>${escapeXml(String(value))}</adlcp:parameter>`
          );
        }
      }

      lines.push("    </resource>");
    });

    lines.push("  </resources>");

    return lines.join("\n");
  }
}

/**
 * Quick manifest generation helper
 */
export function generateManifest(
  metadata: ManifestMetadata,
  organization: ManifestOrganization,
  resources: ManifestResource[]
): string {
  const generator = new ScormManifestGenerator(metadata, organization);

  resources.forEach((resource) => {
    generator.addResource(resource);
  });

  return generator.generate();
}

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Converts milliseconds to ISO 8601 duration
 * Example: 45000 ms → PT45S, 3600000 ms → PT1H
 */
export function msToIsoDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let duration = "PT";
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (seconds > 0) duration += `${seconds}S`;

  return duration || "PT0S";
}

/**
 * Converts ISO 8601 duration to milliseconds
 * Example: PT1H30M45S → 5445000
 */
export function isoDurationToMs(duration: string): number {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/;
  const match = duration.match(regex);

  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseFloat(match[3] || "0");

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
