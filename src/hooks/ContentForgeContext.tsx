import { createContext, ReactNode, useState, useContext } from "react";

export interface VideoSettings {
  selectedAvatar: "rachel" | "josh" | "anna" | string;
  videoQuality: "720p" | "1080p" | "4k";
  backgroundStyle: "simple" | "office" | "classroom";
}

export type LearningType = "static" | "video" | "image";
export type LearningMode = "static_elearning" | "video_learning" | "sop_video" | "image_based_learning";

export interface ContentForgeContextValue {
  learningType: LearningType;
  setLearningType: (type: LearningType) => void;
  videoSettings: VideoSettings | null;
  setVideoSettings: (settings: VideoSettings) => void;
  learningMode: LearningMode;
  setLearningMode: (mode: LearningMode) => void;
  isSOP: boolean;
  setIsSOP: (value: boolean) => void;
}

export const ContentForgeContext = createContext<ContentForgeContextValue | undefined>(undefined);

export function ContentForgeProvider({ children }: { children: ReactNode }) {
  const [learningType, setLearningType] = useState<LearningType>("static");
  const [videoSettings, setVideoSettings] = useState<VideoSettings | null>(null);
  const [learningMode, setLearningMode] = useState<LearningMode>("static_elearning");
  const [isSOP, setIsSOP] = useState(false);

  return (
    <ContentForgeContext.Provider
      value={{
        learningType,
        setLearningType,
        videoSettings,
        setVideoSettings,
        learningMode,
        setLearningMode,
        isSOP,
        setIsSOP,
      }}
    >
      {children}
    </ContentForgeContext.Provider>
  );
}

export function useContentForge(): ContentForgeContextValue {
  const context = useContext(ContentForgeContext);
  if (context === undefined) {
    throw new Error("useContentForge must be used within ContentForgeProvider");
  }
  return context;
}
