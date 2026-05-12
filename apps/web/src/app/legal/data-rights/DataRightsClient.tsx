"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Props = {
  email: string;
  deletionRequestedAt: string | null | undefined;
  deletionScheduledAt: string | null | undefined;
};

export function DataRightsClient({
  email,
  deletionRequestedAt,
  deletionScheduledAt,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/legal/data-export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `keg-data-export-${email}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteRequest() {
    if (deleteConfirm !== email) {
      setDeleteError("이메일을 정확히 입력해야 삭제 요청이 처리됩니다");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/legal/account-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: deleteConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCancelDelete() {
    setDeleting(true);
    try {
      await fetch("/api/legal/account-delete", { method: "DELETE" });
      window.location.reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. 데이터 열람·다운로드 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            1 · 내 데이터 다운로드
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground/90">
            본인의 모든 데이터를 JSON 파일로 다운로드합니다. 프로필·작업 이력·대화·이해도·평가 기록이 포함됩니다.
          </p>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {exporting ? "내보내는 중..." : "⬇ JSON 다운로드"}
          </Button>
          {exportError && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              {exportError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. 계정·데이터 삭제 */}
      <Card
        className={
          deletionRequestedAt
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-red-500/30 bg-red-500/5"
        }
      >
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            2 · 계정·데이터 삭제 요청
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletionRequestedAt ? (
            <>
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                ⚠️ 삭제 요청 접수됨 ({new Date(deletionRequestedAt).toLocaleDateString("ko-KR")}).
                {deletionScheduledAt && (
                  <>
                    <br />
                    예정 삭제일:{" "}
                    <strong>
                      {new Date(deletionScheduledAt).toLocaleDateString("ko-KR")}
                    </strong>{" "}
                    (요청 후 30일).
                  </>
                )}
                <br />이 기간 내 취소 가능.
              </p>
              <Button
                onClick={handleCancelDelete}
                disabled={deleting}
                variant="outline"
              >
                {deleting ? "처리 중..." : "삭제 요청 취소"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground/90">
                계정과 모든 데이터를 영구 삭제합니다. <strong>요청 후 30일 유예 기간</strong>이 있으며,
                기간 내 취소 가능. 30일 후 자동으로 hard-delete됩니다.
              </p>
              <p className="text-xs text-muted-foreground">
                삭제 대상: 프로필·작업 이력·대화·이해도·avatar·임베딩 (관련 법령상 보관 의무 데이터는 제외).
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  확인을 위해 이메일을 입력하세요
                </label>
                <input
                  type="email"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={email}
                  disabled={deleting}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                />
              </div>
              <Button
                onClick={handleDeleteRequest}
                disabled={deleting || deleteConfirm !== email}
                className="bg-red-500/80 text-white hover:bg-red-500"
              >
                {deleting ? "요청 중..." : "🗑 계정·데이터 삭제 요청"}
              </Button>
              {deleteError && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                  {deleteError}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. 기타 권리 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            3 · 기타 권리 행사
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90">
            정정·처리정지·열람 등 기타 권리 행사는 개인정보 보호책임자에게 직접 문의해 주세요.
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            문의: aureinstudio@gmail.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
