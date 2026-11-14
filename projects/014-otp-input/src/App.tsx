import { useEffect, useRef, useState, type FormEvent } from "react";
import { OtpInput, type OtpInputHandle } from "./OtpInput";

const DEMO_CODE = "428913";
const RESEND_SECONDS = 30;

type Status = "idle" | "checking" | "error" | "success";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function EmailVerification() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [attempts, setAttempts] = useState(0);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [notice, setNotice] = useState("");
  const otp = useRef<OtpInputHandle>(null);
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resendIn === 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  // After a wrong code the field is enabled again: put the user back in it and nudge.
  useEffect(() => {
    if (status !== "error") return;
    otp.current?.focus();
    if (!prefersReducedMotion()) {
      field.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 320, easing: "ease-out" },
      );
    }
  }, [status, attempts]);

  const verify = (value: string) => {
    setStatus("checking");
    setNotice("");
    // Stand-in for a network round trip.
    window.setTimeout(() => {
      if (value === DEMO_CODE) {
        setStatus("success");
      } else {
        setStatus("error");
        setAttempts((n) => n + 1);
        setCode("");
      }
    }, 700);
  };

  const resend = () => {
    setResendIn(RESEND_SECONDS);
    setCode("");
    setStatus("idle");
    setNotice("We sent a new code to ada@example.com.");
    // The button disables itself, so hand focus to the cleared field once it re-renders.
    requestAnimationFrame(() => otp.current?.focus());
  };

  const seconds = `0:${String(resendIn).padStart(2, "0")}`;

  return (
    <section className="card" aria-labelledby="verify-title">
      <h2 id="verify-title">Verify your email</h2>
      <div ref={field}>
        <OtpInput
          ref={otp}
          label="Verification code"
          description={`Enter the 6-digit code we sent to ada@example.com. (Demo code: ${DEMO_CODE})`}
          value={code}
          onChange={(next) => {
            setCode(next);
            if (status === "error") setStatus("idle");
          }}
          onComplete={verify}
          groupSize={3}
          disabled={status === "checking" || status === "success"}
          error={status === "error" ? "That code doesn't match. Check the email and try again." : undefined}
          autoFocus
        />
      </div>

      <div className="verify__footer">
        <p className="verify__status" aria-live="polite">
          {status === "checking" && "Checking…"}
          {status === "success" && "✓ Email verified"}
          {status !== "checking" && status !== "success" && notice}
        </p>
        {status !== "success" && (
          <button type="button" className="button button--quiet" onClick={resend} disabled={resendIn > 0}>
            {resendIn > 0 ? `Resend code in ${seconds}` : "Resend code"}
          </button>
        )}
      </div>
    </section>
  );
}

function RecoveryCode() {
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitted(String(data.get("recovery")));
  };

  const copySample = async () => {
    try {
      await navigator.clipboard.writeText("k7q2-m9xd");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card" aria-labelledby="recovery-title">
      <h2 id="recovery-title">Use a recovery code</h2>
      <form onSubmit={submit} className="recovery">
        <OtpInput
          label="Recovery code"
          description="Letters and numbers, from the list you saved when you set up two-factor sign-in."
          value={code}
          onChange={(next) => {
            setCode(next);
            setSubmitted(null);
          }}
          length={8}
          kind="alphanumeric"
          groupSize={4}
          name="recovery"
        />
        <div className="recovery__actions">
          <button type="submit" className="button" disabled={code.length < 8}>
            Sign in
          </button>
          <button type="button" className="button button--quiet" onClick={copySample}>
            Copy a sample code
          </button>
        </div>
      </form>
      <p className="footnote" aria-live="polite">
        {submitted
          ? `Form submitted recovery=${submitted}`
          : copied
            ? "Copied “k7q2-m9xd”. Paste it into any box: it gets uppercased and the dash is dropped."
            : "Try pasting a code with dashes or lowercase letters."}
      </p>
    </section>
  );
}

export function App() {
  return (
    <main className="page">
      <header>
        <h1>One-Time Code Input</h1>
        <p className="lead">
          Segmented code field with paste and SMS autofill, keyboard editing that behaves like a text field, and
          errors that screen readers announce.
        </p>
      </header>
      <EmailVerification />
      <RecoveryCode />
    </main>
  );
}
