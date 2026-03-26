import React, { useState, useCallback, useRef } from "react";
import PaynowQR from "paynowqr";
import QRCode from "react-qr-code";

interface PayNowQRProps {
  uen: string;
  total: number;
  refNumber: string;
  company?: string;
}

const PayNowQRGenerator: React.FC<PayNowQRProps> = ({
  uen,
  total,
  refNumber,
  company = "EventSH",
}) => {
  const [qrValue, setQrValue] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const generateQR = useCallback(() => {
    // Fixed PaynowQR syntax - direct object, not constructor
    const qrData = PaynowQR({
      uen, // Required UEN
      amount: total, // Fixed amount
      editable: false, // Locks amount (PayNow apps respect this)
      refNumber, // Invoice/order ID
      company, // Merchant name
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, ""), // YYYYMMDD format
    });

    setQrValue(qrData); // qrData is already the EMV string
  }, [uen, total, refNumber, company]);

  const downloadQR = useCallback(() => {
    if (qrRef.current) {
      const canvas = qrRef.current.querySelector("canvas");
      if (canvas) {
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = url;
        link.download = `paynow-${refNumber}.png`;
        link.click();
      }
    }
  }, [refNumber]);

  return (
    <div>
      <button
        onClick={generateQR}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        Generate Payment QR
      </button>

      {qrValue && (
        <div className="mt-4 p-4 border rounded-lg text-center">
          <div ref={qrRef}>
            <QRCode
              value={qrValue}
              size={256}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              viewBox="0 0 256 256" // Ensures proper canvas rendering
            />
          </div>

          <p className="mt-2 text-sm font-medium">
            Scan to pay S${total.toFixed(2)} (Fixed amount)
          </p>

          <button
            onClick={downloadQR}
            className="mt-2 px-4 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Download QR
          </button>
        </div>
      )}
    </div>
  );
};

export default PayNowQRGenerator;
