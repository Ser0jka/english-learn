import type { Dispatch, SetStateAction } from "react";
import type { Store } from "./domain";
import type { Mode, Phrase, Word } from "./data";
export type HelpContext = { word?: Word; phrase?: Phrase; text?: string };
export interface StudyProps {
  store: Store;
  setStore: Dispatch<SetStateAction<Store>>;
  mode: Mode;
  notify: (message: string) => void;
  onHelp: (context: HelpContext) => void;
  onContext: (context: HelpContext) => void;
}
