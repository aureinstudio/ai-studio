import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadToStorage } from "@/lib/storage";
import type { ScriptEntry } from "./script-writer";
import type { AudioFile } from "./tts";
import type { AgentLog } from "../base";

export type Chapter = {
  title: string;
  slide_number: number;
  start_time_sec: number;
  end_time_sec: number;
};

export type CaptionsResult = {
  srt_url: string;
  srt_path: string;
  chapters_url: string;
  chapters_path: string;
  chapters: Chapter[];
  total_duration_sec: number;
};

/**
 * Cast Agent #05 — 자막·챕터 생성.
 *
 * 스크립트 + 음성 길이 → SRT 자막 + chapters JSON.
 * 두 파일을 Supabase Storage 'cast-captions' 버킷에 업로드.
 * LLM 호출 없음 — 단순 포매팅·계산.
 */
export async function runCastCaptionsChapters(
  supabase: SupabaseClient,
  castJobId: string,
  scripts: ScriptEntry[],
  audioFiles: AudioFile[],
  topic: string,
): Promise<{ result: CaptionsResult; log: AgentLog }> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  try {
    // slide_number로 빠른 lookup
    const audioBySlide = new Map(audioFiles.map((a) => [a.slide_number, a]));

    let currentTime = 0;
    const srtBlocks: string[] = [];
    const chapters: Chapter[] = [];

    const sortedScripts = [...scripts].sort((a, b) => a.slide_number - b.slide_number);
    sortedScripts.forEach((script, idx) => {
      const audio = audioBySlide.get(script.slide_number);
      const duration = audio?.duration_estimate_sec ?? Math.max(3, Math.ceil(script.script_text.length / 15));

      const startSec = currentTime;
      const endSec = currentTime + duration;

      // SRT entry
      srtBlocks.push(
        `${idx + 1}\n${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}\n${script.script_text}`,
      );

      chapters.push({
        title: `슬라이드 ${script.slide_number}`,
        slide_number: script.slide_number,
        start_time_sec: startSec,
        end_time_sec: endSec,
      });

      currentTime = endSec;
    });

    const srtContent = srtBlocks.join("\n\n");
    const chaptersContent = JSON.stringify(
      { topic, total_duration_sec: currentTime, chapters },
      null,
      2,
    );

    const { url: srtUrl, path: srtPath } = await uploadToStorage(
      supabase,
      "cast-captions",
      `${castJobId}/captions.srt`,
      srtContent,
      "application/x-subrip",
    );

    const { url: chaptersUrl, path: chaptersPath } = await uploadToStorage(
      supabase,
      "cast-captions",
      `${castJobId}/chapters.json`,
      chaptersContent,
      "application/json",
    );

    const completedAt = new Date().toISOString();
    const log: AgentLog = {
      agent_id: "cast-05",
      agent_name: "자막·챕터 생성",
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: srtContent.length,
      cost_usd: 0, // 외부 API 미사용
    };

    return {
      result: {
        srt_url: srtUrl,
        srt_path: srtPath,
        chapters_url: chaptersUrl,
        chapters_path: chaptersPath,
        chapters,
        total_duration_sec: currentTime,
      },
      log,
    };
  } catch (err) {
    const log: AgentLog = {
      agent_id: "cast-05",
      agent_name: "자막·챕터 생성",
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      error: err instanceof Error ? err.message : String(err),
    };
    return {
      result: {
        srt_url: "",
        srt_path: "",
        chapters_url: "",
        chapters_path: "",
        chapters: [],
        total_duration_sec: 0,
      },
      log,
    };
  }
}

/**
 * SRT timestamp 포맷: HH:MM:SS,mmm
 */
function formatSrtTime(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = Math.floor(totalSec % 60);
  const ms = Math.floor((totalSec - Math.floor(totalSec)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad3(ms)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : `${n}`;
}
