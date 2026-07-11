import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BedDouble, Check, Loader2, Users, StickyNote } from "lucide-react";

const apiURL = __API_URL__;

interface RoomPass {
  guestName: string;
  coupleNames: string;
  eventTitle: string;
  functionName: string;
  roomType: string;
  roomTypeLabel: string;
  roomName: string;
  shared?: boolean;
  occupants: number;
  occupantNames: string[];
  notes: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

/**
 * Public reception page opened by scanning a wedding room-pass QR. Shows the
 * guest + room details and lets the hotel desk confirm check-in (allot).
 */
export default function WeddingRoomTicket() {
  const { token } = useParams();
  const [data, setData] = useState<RoomPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiURL}/wedding-room/${token}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Room pass not found");
      setData(j.data);
    } catch (e: any) {
      setError(e?.message || "Room pass not found");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const checkIn = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${apiURL}/wedding-room/${token}/check-in`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Couldn't check in");
      setData(j.data);
    } catch (e: any) {
      setError(e?.message || "Couldn't check in");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-rose-50 px-4 py-10"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-xl">
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-6 py-6 text-center text-white">
          <div className="text-[11px] uppercase tracking-[3px] opacity-90">
            Accommodation Pass
          </div>
          <div className="mt-1 text-2xl font-bold">
            {data?.coupleNames || "The Wedding"}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-500">{error}</p>
          ) : data ? (
            <>
              {data.checkedIn && (
                <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-sm font-semibold text-green-700">
                  <Check className="h-4 w-4" /> Checked in
                  {data.checkedInAt
                    ? ` · ${new Date(data.checkedInAt).toLocaleString()}`
                    : ""}
                </div>
              )}

              <div className="text-center">
                <div className="text-[11px] uppercase tracking-widest text-stone-400">
                  {data.functionName || "Stay"}
                </div>
                <div className="mt-1 text-2xl font-bold text-rose-800">
                  {data.roomName}
                </div>
                {data.shared && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    <Users className="h-3 w-3" /> Shared room
                  </div>
                )}
                <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-stone-500">
                  <BedDouble className="h-4 w-4" />
                  {data.roomTypeLabel} · {data.occupants} occupant
                  {data.occupants === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t pt-4 text-sm">
                <Row label="Guest" value={data.guestName} />
                {data.occupantNames.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-400" />
                    <div>
                      <div className="text-xs uppercase tracking-wide text-stone-400">
                        In this room
                      </div>
                      <div className="text-stone-700">
                        {data.occupantNames.join(", ")}
                      </div>
                    </div>
                  </div>
                )}
                {data.notes && (
                  <div className="flex items-start gap-2">
                    <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-400" />
                    <div className="text-stone-600">{data.notes}</div>
                  </div>
                )}
              </div>

              {!data.checkedIn && (
                <button
                  onClick={checkIn}
                  disabled={checking}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {checking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                  Confirm check-in &amp; allot room
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-stone-400">
        {label}
      </span>
      <span className="font-medium text-stone-800">{value}</span>
    </div>
  );
}
