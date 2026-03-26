import React, { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const ReceiptShare = ({
  title = "Receipt",
  description = "Your receipt details here...",
}) => {
  const receiptRef = useRef();

  const handleShare = async () => {
    try {
      // 1️⃣ Convert receipt HTML to canvas
      const canvas = await html2canvas(receiptRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      // 2️⃣ Create a new PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);

      // 3️⃣ Convert PDF to Blob
      const pdfBlob = pdf.output("blob");

      // 4️⃣ Create a File from the Blob (required for sharing)
      const file = new File([pdfBlob], "receipt.pdf", {
        type: "application/pdf",
      });

      // 5️⃣ Try to share
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title,
          text: description,
          files: [file],
        });
      } else {
        // 6️⃣ Fallback to download
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = "receipt.pdf";
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (error) {
      console.error("Error sharing receipt:", error);
    }
  };

  return (
    <div className="p-4">
      {/* Receipt UI (you can style this as needed) */}
      <div
        ref={receiptRef}
        className="border rounded-lg p-4 bg-white w-[300px]"
      >
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <p>{description}</p>
        <p>Date: {new Date().toLocaleDateString()}</p>
        <p>Order ID: #123456</p>
      </div>

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md"
      >
        Share / Download Receipt
      </button>
    </div>
  );
};

export default ReceiptShare;
