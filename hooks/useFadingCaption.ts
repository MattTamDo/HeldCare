"use client";

import { useEffect, useRef, useState } from "react";

import {
  isDisclaimerCaption,
  splitSpokenSentences,
} from "@/lib/assessment/captions";

function currentUnit(text: string): string {
  const { done, open } = splitSpokenSentences(text);
  const unit = open || done.at(-1) || "";
  return unit && !isDisclaimerCaption(unit) ? unit : "";
}

/**
 * Shows the sentence being spoken. It stays up until `voicePlaying` goes
 * from true to false — that is, until the spoken audio actually ends.
 */
export function useFadingCaption(text: string, voicePlaying: boolean): string {
  const [caption, setCaption] = useState("");
  const heardVoice = useRef(false);

  useEffect(() => {
    if (!text) {
      heardVoice.current = false;
      setCaption("");
      return;
    }
    const unit = currentUnit(text);
    if (unit) setCaption(unit);
  }, [text]);

  useEffect(() => {
    if (voicePlaying) {
      heardVoice.current = true;
      return;
    }
    if (!heardVoice.current) return;
    const timer = window.setTimeout(() => {
      heardVoice.current = false;
      setCaption("");
    }, 200);
    return () => window.clearTimeout(timer);
  }, [text, voicePlaying]);

  return caption;
}

/** Last user sentence. Hidden while the copilot voice is playing. */
export function useListenerCaption(text: string, hidden: boolean): string {
  const [caption, setCaption] = useState("");
  const consumed = useRef(0);

  useEffect(() => {
    if (!text) {
      consumed.current = 0;
      setCaption("");
      return;
    }
    if (hidden) {
      consumed.current = text.length;
      setCaption("");
      return;
    }
    const unit = currentUnit(text.slice(consumed.current));
    if (unit) setCaption(unit);
  }, [hidden, text]);

  return caption;
}
