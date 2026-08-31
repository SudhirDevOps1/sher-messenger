"use client";

import { useState } from "react";

export function CalculatorDecoy({ onUnlock }: { onUnlock: () => void }) {
  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState("");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [clearOnNext, setClearOnNext] = useState(false);

  const handleNum = (n: string) => {
    if (display === "0" || clearOnNext) {
      setDisplay(n);
      setClearOnNext(false);
    } else {
      setDisplay((p) => (p.length < 12 ? p + n : p));
    }
  };

  const handleOp = (nextOp: string) => {
    const cur = parseFloat(display);
    if (prev === null) {
      setPrev(cur);
      setHistory(`${cur} ${nextOp}`);
    } else if (op) {
      const res = calculate(prev, cur, op);
      setPrev(res);
      setDisplay(String(res));
      setHistory(`${res} ${nextOp}`);
    }
    setOp(nextOp);
    setClearOnNext(true);
  };

  const calculate = (a: number, b: number, operation: string): number => {
    switch (operation) {
      case "+":
        return a + b;
      case "−":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b !== 0 ? a / b : 0;
      default:
        return b;
    }
  };

  const handleEquals = () => {
    // Stealth Passcode check: If user enters 1337 and presses '=' -> unlock Vault!
    if (display === "1337") {
      onUnlock();
      return;
    }

    if (prev !== null && op) {
      const cur = parseFloat(display);
      const res = calculate(prev, cur, op);
      setDisplay(String(res));
      setHistory("");
      setPrev(null);
      setOp(null);
      setClearOnNext(true);
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setHistory("");
    setPrev(null);
    setOp(null);
    setClearOnNext(false);
  };

  const buttons = [
    { label: "C", type: "fn", onClick: handleClear },
    { label: "±", type: "fn", onClick: () => setDisplay((d) => String(parseFloat(d) * -1)) },
    { label: "%", type: "fn", onClick: () => setDisplay((d) => String(parseFloat(d) / 100)) },
    { label: "÷", type: "op", onClick: () => handleOp("÷") },
    { label: "7", type: "num", onClick: () => handleNum("7") },
    { label: "8", type: "num", onClick: () => handleNum("8") },
    { label: "9", type: "num", onClick: () => handleNum("9") },
    { label: "×", type: "op", onClick: () => handleOp("×") },
    { label: "4", type: "num", onClick: () => handleNum("4") },
    { label: "5", type: "num", onClick: () => handleNum("5") },
    { label: "6", type: "num", onClick: () => handleNum("6") },
    { label: "−", type: "op", onClick: () => handleOp("−") },
    { label: "1", type: "num", onClick: () => handleNum("1") },
    { label: "2", type: "num", onClick: () => handleNum("2") },
    { label: "3", type: "num", onClick: () => handleNum("3") },
    { label: "+", type: "op", onClick: () => handleOp("+") },
    { label: "0", type: "num", onClick: () => handleNum("0"), colSpan: 2 },
    { label: ".", type: "num", onClick: () => !display.includes(".") && setDisplay((d) => d + ".") },
    { label: "=", type: "eq", onClick: handleEquals },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1c1e] p-4 text-white font-sans select-none animate-fadeIn">
      <div className="w-full max-w-xs rounded-3xl bg-[#000] p-6 shadow-2xl border border-[#333]">
        <div className="mb-4 text-right">
          <div className="h-5 text-xs text-gray-400 font-mono">{history}</div>
          <div className="text-4xl font-light tracking-tight text-white truncate">{display}</div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {buttons.map((b, idx) => (
            <button
              key={idx}
              type="button"
              onClick={b.onClick}
              className={`h-14 rounded-full text-xl font-medium transition active:opacity-70 ${
                b.colSpan === 2 ? "col-span-2 text-left pl-6" : ""
              } ${
                b.type === "op" || b.type === "eq"
                  ? "bg-[#ff9f0a] text-white hover:bg-[#ffb03a]"
                  : b.type === "fn"
                  ? "bg-[#a5a5a5] text-black hover:bg-[#d4d4d2]"
                  : "bg-[#333333] text-white hover:bg-[#444444]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[10.5px] text-gray-600 font-mono">
          Standard Calculator · Enter PIN and press = to unlock
        </p>
      </div>
    </div>
  );
}