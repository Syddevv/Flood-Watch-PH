"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, LoaderCircle, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { captureVideoFrameToFile } from "@/lib/report-image-browser";
import { describeCameraError } from "@/lib/report-image-capture";

type CameraPhase = "requesting" | "streaming" | "capturing" | "captured" | "error";

type ReportCameraCaptureProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, capturedAt: Date) => void;
  /** Escape hatch offered on every failure: close and open the file picker. */
  onUploadInstead: () => void;
};

/**
 * Take a flood photo without leaving the page.
 *
 * The camera is only ever started from an explicit button press, and every
 * exit path stops the media tracks - a leaked track leaves the device's camera
 * light on after the user thinks they closed it. Frames the user rejects never
 * leave the browser.
 *
 * Follows the dialog conventions in components/weather-alert-viewer.tsx:
 * scrim + role="dialog" + aria-modal, Escape to close, body scroll lock,
 * initial focus, bottom sheet on mobile and a centred card on desktop.
 */
export function ReportCameraCapture({
  open,
  onClose,
  onCapture,
  onUploadInstead,
}: ReportCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shutterButtonRef = useRef<HTMLButtonElement | null>(null);

  const [phase, setPhase] = useState<CameraPhase>("requesting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const discardCapture = useCallback(() => {
    setCapturedFile(null);
    setCapturedAt(null);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  /**
   * Reset on the way out rather than on the way in: the open effect must not
   * call setState synchronously (react-hooks/set-state-in-effect), so the
   * modal is instead guaranteed to be back at "requesting" before it reopens.
   */
  const resetToRequesting = useCallback(() => {
    stopStream();
    discardCapture();
    setErrorMessage(null);
    setPhase("requesting");
  }, [discardCapture, stopStream]);

  const handleClose = useCallback(() => {
    resetToRequesting();
    onClose();
  }, [onClose, resetToRequesting]);

  // Acquire the stream when the modal opens, release it whenever it closes or
  // unmounts. The cleanup is the important half.
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });

        if (cancelled) {
          // The modal closed while the permission prompt was open.
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Phase stays "requesting" until the video reports real dimensions -
        // see handleVideoReady. A stream that has resolved is not yet a stream
        // you can draw: capturing here yields a 0x0 frame.
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(describeCameraError(error));
        setPhase("error");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, open]);

  useEffect(() => {
    if (!open || phase !== "streaming") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      shutterButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, phase]);

  // Drop any object URL the modal created, including on unmount.
  useEffect(() => {
    return () => {
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
    };
  }, []);

  if (!open) {
    return null;
  }

  /**
   * The stream only becomes usable once the video knows its frame size, so
   * the shutter stays disabled until then. Both events are wired because a
   * stream can settle through either, and the transition is idempotent.
   */
  function handleVideoReady() {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    setPhase((current) => (current === "requesting" ? "streaming" : current));
  }

  async function handleShutter() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setPhase("capturing");
    const now = new Date();
    const file = await captureVideoFrameToFile(video, now);

    if (!file) {
      setErrorMessage("The camera didn't return a usable frame. Try again.");
      setPhase("streaming");
      return;
    }

    setCapturedFile(file);
    setCapturedAt(now);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase("captured");
  }

  function handleRetake() {
    // The stream is deliberately left running so retake is instant.
    discardCapture();
    setErrorMessage(null);
    setPhase("streaming");
  }

  function handleUsePhoto() {
    if (!capturedFile || !capturedAt) {
      return;
    }

    onCapture(capturedFile, capturedAt);
    resetToRequesting();
  }

  function handleUploadInstead() {
    resetToRequesting();
    onUploadInstead();
  }

  const showLiveVideo = phase !== "captured" && phase !== "error";

  return (
    <>
      <div
        aria-hidden="true"
        className="floodwatch-scrim fixed inset-0 z-[var(--layer-modal-backdrop)] backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-[var(--layer-modal)] flex items-end justify-center p-0 md:items-center md:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-camera-title"
          data-testid="report-camera-modal"
          className="flex max-h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[20px] border border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] md:max-h-[90vh] md:rounded-[18px]"
        >
          <div className="shrink-0 border-b border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] px-4 pb-3 pt-3 md:px-5">
            <div className="flex justify-center md:hidden">
              <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
            </div>
            <div className="mt-2 flex items-start justify-between gap-3 md:mt-0">
              <div className="min-w-0">
                <h2
                  id="report-camera-title"
                  className="text-[1rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]"
                >
                  Take a photo
                </h2>
                <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
                  {phase === "captured"
                    ? "Use this photo or retake it. It is attached only when you submit the report."
                    : "The photo is attached to your report only after you choose Use photo."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close camera"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] text-[var(--color-muted-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoReady}
              onCanPlay={handleVideoReady}
              data-testid="camera-preview"
              className={cn(
                "h-full max-h-[52dvh] w-full object-contain",
                showLiveVideo ? "block" : "hidden",
              )}
            />

            {phase === "requesting" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[0.86rem] text-white/85">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                <span>Starting camera...</span>
              </div>
            ) : null}

            {phase === "captured" && previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt="Captured flood photo preview"
                data-testid="camera-captured-preview"
                className="h-full max-h-[52dvh] w-full object-contain"
              />
            ) : null}

            {phase === "error" ? (
              <div className="px-6 py-10 text-center">
                <Camera className="mx-auto h-7 w-7 text-white/70" />
                <p
                  role="alert"
                  data-testid="camera-error"
                  className="mt-3 text-[0.88rem] leading-6 text-white/90"
                >
                  {errorMessage}
                </p>
              </div>
            ) : null}
          </div>

          {errorMessage && phase !== "error" ? (
            <p
              role="alert"
              className="mx-4 mt-3 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-3 py-2 text-[0.8rem] leading-5 text-[var(--color-danger-text)] md:mx-5"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex shrink-0 flex-col gap-2 border-t border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] px-4 py-3 sm:flex-row sm:justify-end md:px-5">
            {phase === "error" ? (
              <button
                type="button"
                data-testid="camera-upload-instead"
                onClick={handleUploadInstead}
                className="flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.92rem] font-semibold text-white"
              >
                <ImageUp className="h-4 w-4" />
                <span>Upload photo instead</span>
              </button>
            ) : null}

            {phase === "captured" ? (
              <>
                <button
                  type="button"
                  data-testid="camera-retake"
                  onClick={handleRetake}
                  className="flex h-11 items-center justify-center gap-2 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-4 text-[0.9rem] font-medium text-[var(--color-foreground)]"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  data-testid="camera-use-photo"
                  onClick={handleUsePhoto}
                  className="flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.92rem] font-semibold text-white"
                >
                  <Camera className="h-4 w-4" />
                  <span>Use photo</span>
                </button>
              </>
            ) : null}

            {showLiveVideo ? (
              <button
                type="button"
                ref={shutterButtonRef}
                data-testid="camera-shutter"
                onClick={() => void handleShutter()}
                disabled={phase !== "streaming"}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-[11px] px-4 text-[0.92rem] font-semibold text-white",
                  phase === "streaming"
                    ? "bg-[var(--color-primary)]"
                    : "cursor-not-allowed border border-[var(--color-disabled-border)] bg-[var(--color-disabled-surface)] text-[var(--color-disabled-text)]",
                )}
              >
                {phase === "capturing" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <span>{phase === "capturing" ? "Capturing..." : "Capture photo"}</span>
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
