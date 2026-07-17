"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import SignatureCanvas from "react-signature-canvas";

export type ResponsiveSignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataUrl: () => string;
};

type ResponsiveSignaturePadProps = {
  height?: number;
  penColor?: string;
  className?: string;
};

export const ResponsiveSignaturePad = forwardRef<
  ResponsiveSignaturePadHandle,
  ResponsiveSignaturePadProps
>(function ResponsiveSignaturePad(
  {
    height = 240,
    penColor = "#111827",
    className = "",
  },
  forwardedRef,
) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const signatureRef = useRef<SignatureCanvas | null>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateWidth = () => {
      const nextWidth = Math.max(280, Math.floor(wrapper.getBoundingClientRect().width));
      setWidth((current) => current === nextWidth ? current : nextWidth);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    clear: () => signatureRef.current?.clear(),
    isEmpty: () => signatureRef.current?.isEmpty() ?? true,
    toDataUrl: () => signatureRef.current?.getTrimmedCanvas().toDataURL("image/png") || "",
  }), []);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden bg-white ${className}`}
      style={{ height }}
    >
      <SignatureCanvas
        key={`${width}x${height}`}
        ref={signatureRef}
        penColor={penColor}
        backgroundColor="rgba(255,255,255,0)"
        canvasProps={{
          width,
          height,
          className: "block touch-none bg-transparent",
          style: { width: `${width}px`, height: `${height}px`, maxWidth: "100%" },
        }}
      />
    </div>
  );
});
