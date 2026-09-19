"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createEntry } from "@/lib/entries";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialDateMs?: number;
}

export function ComposeModal({ open, onClose, onCreated, initialDateMs }: Props) {
  const { user, settings } = useAuth();
  const [text, setText] = useState("");
  const [dateLocal, setDateLocal] = useState("");
  const [address, setAddress] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText("");
    setPhoto(null);
    setPreview(null);
    setAddress("");
    const d = initialDateMs ? new Date(initialDateMs) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setDateLocal(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );

    if (settings.locationEnabled !== false && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            // Reverse geocode via OpenStreetMap Nominatim (no key); fail soft
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`,
              { headers: { Accept: "application/json" } }
            );
            if (res.ok) {
              const data = (await res.json()) as { display_name?: string };
              if (data.display_name) setAddress(data.display_name);
            } else {
              setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            }
          } catch {
            /* ignore */
          }
        },
        () => {
          /* user denied */
        },
        { timeout: 8000 }
      );
    }
  }, [open, initialDateMs, settings.locationEnabled]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!open) return null;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhoto(f);
  };

  const onSave = async () => {
    if (!user || !text.trim()) return;
    setSaving(true);
    try {
      const date_journal = dateLocal
        ? new Date(dateLocal).getTime()
        : Date.now();
      await createEntry(user.uid, {
        text,
        date_journal,
        address: address || undefined,
        photoFile: photo,
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error("Error saving entry:", err);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 text-sm min-h-[44px] px-2"
          >
            キャンセル
          </button>
          <h2 className="font-semibold text-[#1A3A4A]">新規作成</h2>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !text.trim()}
            className="text-[#4AB8D8] font-semibold text-sm min-h-[44px] px-2 disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[#1A3A4A] mb-1 block">日付</span>
            <input
              type="datetime-local"
              value={dateLocal}
              onChange={(e) => setDateLocal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#1A3A4A] mb-1 block">本文</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="今日のことを書いてみましょう…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y min-h-[160px]"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#1A3A4A] mb-1 block">場所（任意）</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="場所"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </label>

          <div>
            <p className="text-sm font-medium text-[#1A3A4A] mb-2">写真（1枚まで）</p>
            {(preview || photo) && (
              <div className="relative mb-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview || ""}
                  alt=""
                  className="w-32 h-32 object-cover rounded-lg bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white text-xs"
                >
                  ×
                </button>
              </div>
            )}
            {!photo && (
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <span className="text-sm text-gray-600">写真を追加</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
