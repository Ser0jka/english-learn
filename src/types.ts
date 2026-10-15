import type { Dispatch, SetStateAction } from "react";
import type { Store } from "./domain";
import type { Mode, Phrase, Word } from "./data";
export type HelpContext = { word?: Word; phrase?: Phrase; text?: string };
export type NoticeAction = { label: string; onClick: () => void };
export interface StudyProps {
  store: Store;
  setStore: Dispatch<SetStateAction<Store>>;
  mode: Mode;
  notify: (message: string, action?: NoticeAction) => void;
  onAddWords: () => void;
  onNavigate: (page: import("./data").Page) => void;
  onModeChange: (mode: Mode) => void;
  storageError: string;
  onHelp: (context: HelpContext) => void;
  onContext: (context: HelpContext) => void;
}
