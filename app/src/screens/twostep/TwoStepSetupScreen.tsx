import { useState, type FormEvent } from 'react'
import { Button, buttonClasses } from '../../components/Button'
import { CodeInput, StepBars } from '../../components/CodeInput'
import { Screen } from '../../components/Screen'
import { IconCheck, IconChevronLeft, IconClockSmall, IconExternal, IconPhoneCheck, Logo } from '../../components/icons'
import { useGroupLabel } from '../../auth/group'
import { BackupCodes } from './BackupCodes'
import { TwoStepError, useEnroll, useRefreshMe, useVerifyEnrollment } from './useTwoStep'

type Enrollment = { factorId: string; qrCode: string; secret: string; uri: string }

/**
 * 2-step setup 1 to 4 (design/screens/MFA-Choose, -Scan, -Verify, -Backup). One
 * route, so a reload starts over from a new secret. An admin who has none gets it
 * from RequireAuth (`required`, with a way to sign out); anyone else opens it from
 * Profile. The board's Text message option waits, since it adds a Twilio cost. The
 * board's QR code is for "another phone"; few people have one, so it's for a computer.
 */
export function TwoStepSetupScreen({
  required = false,
  signOut,
  onDone,
}: {
  required?: boolean
  signOut?: () => Promise<void>
  onDone: () => void
}) {
  const refreshMe = useRefreshMe()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const enroll = useEnroll()
  const [round] = useState(() => crypto.randomUUID())

  const start = () =>
    enroll.mutate(undefined, {
      onSuccess: (data) => {
        setEnrollment(data)
        setStep(2)
      },
    })

  return (
    <Screen>
      {step === 1 && (
        <ChooseStep
          required={required}
          signOut={signOut}
          busy={enroll.isPending}
          failed={enroll.isError}
          onNext={start}
        />
      )}
      {step === 2 && enrollment && (
        <ScanStep enrollment={enrollment} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && enrollment && (
        <VerifyStep
          factorId={enrollment.factorId}
          onBack={() => setStep(2)}
          restart={start}
          restarting={enroll.isPending}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <BackupCodes
          round={round}
          header={
            <div className="flex flex-none flex-col gap-2.5 px-6 pt-[calc(20px+var(--safe-top))]">
              <div className="flex min-h-6 items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-13 font-bold text-brand">
                  <IconCheck size={16} />
                  2-step verification is on
                </span>
                <StepCount step={4} />
              </div>
              <StepBars step={4} />
            </div>
          }
          onDone={() => void refreshMe().then(onDone)}
        />
      )}
    </Screen>
  )
}

const StepCount = ({ step }: { step: number }) => (
  <span className="text-13 font-semibold text-text-secondary">Step {step} of 4</span>
)

function BackHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div className="flex flex-none flex-col gap-2.5 pl-3 pr-6 pt-[calc(12px+var(--safe-top))]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </button>
        <StepCount step={step} />
      </div>
      <StepBars step={step} className="pl-3" />
    </div>
  )
}

function ChooseStep({
  required,
  signOut,
  busy,
  failed,
  onNext,
}: {
  required: boolean
  signOut?: () => Promise<void>
  busy: boolean
  failed: boolean
  onNext: () => void
}) {
  const group = useGroupLabel()
  const requires = group ? `${group} requires` : 'Your group requires'
  return (
    <>
      <div className="flex flex-none flex-col gap-3.5 px-6 pt-[calc(20px+var(--safe-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-display text-17 font-bold">OnTrack</span>
          </div>
          <StepCount step={1} />
        </div>
        <StepBars step={1} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-28 font-bold leading-[1.15] tracking-[-0.02em]">
            Turn on 2-step verification
          </h1>
          <p className="text-15 leading-normal text-text-secondary">
            {required ? `${requires} a second step when you sign in.` : 'Add a second step when you sign in.'} Even if
            someone gets your password, they can&apos;t get in without it.
          </p>
        </div>
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="pb-2 text-13 font-semibold text-text-body">How do you want to get codes?</legend>
          <label className="flex cursor-pointer items-start gap-3.5 rounded-card border-[1.5px] border-brand bg-surface p-4 shadow-[inset_0_0_0_1px_var(--brand)]">
            <input
              type="radio"
              name="method"
              defaultChecked
              className="m-0 mt-0.5 h-5 w-5 flex-none accent-brand-fill"
            />
            <span className="flex flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-16 font-semibold">
                Authenticator app
                <span className="rounded-pill bg-brand-tint px-2 py-0.5 text-11 font-bold text-brand-strong">
                  Recommended
                </span>
              </span>
              <span className="text-13 leading-[1.45] text-text-secondary">
                Use an app on your phone, like Google Authenticator, Microsoft Authenticator or 1Password. Works without
                signal.
              </span>
            </span>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-control bg-brand-tint text-brand">
              <IconPhoneCheck />
            </span>
          </label>
        </fieldset>
      </div>
      <div className="flex flex-none flex-col gap-1.5 px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
        {failed && (
          <span role="alert" className="text-13 font-semibold text-danger">
            That didn&apos;t start. Check your connection and try again.
          </span>
        )}
        <Button loading={busy} onClick={onNext}>
          Continue
        </Button>
        {signOut && (
          <Button variant="ghost" className="self-center" onClick={() => void signOut()}>
            Sign out
          </Button>
        )}
      </div>
    </>
  )
}

function ScanStep({ enrollment, onBack, onNext }: { enrollment: Enrollment; onBack: () => void; onNext: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      // Without the on-screen spaces, which are only for reading: not every app accepts them.
      await navigator.clipboard.writeText(enrollment.secret)
      setCopied(true)
    } catch {
      // No clipboard access: the key is on screen to type.
    }
  }
  return (
    <>
      <BackHeader step={2} onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-26 font-bold tracking-[-0.02em]">Connect your authenticator app</h1>
          <p className="text-15 leading-normal text-text-secondary">
            On your phone, tap below and your authenticator app will add OnTrack for you.
          </p>
        </div>
        <a href={enrollment.uri} className={`${buttonClasses('primary')} no-underline`}>
          <IconExternal />
          Open authenticator app
        </a>
        <div className="flex items-center gap-3 text-12 font-bold uppercase tracking-[.06em] text-text-secondary before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          On a computer
        </div>
        <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-3.5">
          {/* A QR code needs its light background in dark mode too. The board draws 112px, but the
              real code is far denser than its drawing and needs the room to scan. */}
          <span className="flex-none rounded-square bg-white p-1">
            <img
              src={enrollment.qrCode}
              width={144}
              height={144}
              alt="QR code to add OnTrack to an authenticator app"
            />
          </span>
          <p className="text-13 leading-normal text-text-body">
            Open your authenticator app on your phone, tap <b>Add</b> or <b>+</b>, then scan this code.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-13 font-semibold text-text-body">Can&apos;t scan? Enter this key in the app</span>
          <div className="box-border flex min-h-12 items-center gap-2 rounded-input border border-border-strong bg-surface py-1 pl-3.5 pr-1">
            <span
              data-testid="two-step-secret"
              className="flex-1 font-mono text-14 tracking-[.04em] [overflow-wrap:anywhere]"
            >
              {enrollment.secret.match(/.{1,4}/g)?.join(' ')}
            </span>
            <button
              type="button"
              onClick={() => void copy()}
              aria-live="polite"
              className="min-h-10 rounded-[8px] bg-brand-tint px-3 text-13 font-semibold text-brand-strong"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-none px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
        <Button variant="secondary" className="min-h-[52px] text-16 font-bold" onClick={onNext}>
          I&apos;ve added it, continue
        </Button>
      </div>
    </>
  )
}

function VerifyStep({
  factorId,
  onBack,
  restart,
  restarting,
  onNext,
}: {
  factorId: string
  onBack: () => void
  restart: () => void
  restarting: boolean
  onNext: () => void
}) {
  const [code, setCode] = useState('')
  const verify = useVerifyEnrollment()
  const ready = code.length === 6
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready) verify.mutate({ factorId, code }, { onSuccess: onNext })
  }
  const error = verify.error
    ? verify.error instanceof TwoStepError
      ? verify.error.message
      : "Couldn't check that. Check your connection and try again."
    : null
  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <BackHeader step={3} onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-26 font-bold tracking-[-0.02em]">Enter the 6-digit code</h1>
          <p className="text-15 leading-normal text-text-secondary">
            Find <b className="text-text">OnTrack</b> in your authenticator app and type the code it shows.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <CodeInput
            id="setup-code"
            label="Verification code"
            value={code}
            onChange={(next) => {
              setCode(next)
              if (verify.isError) verify.reset()
            }}
            error={error}
          />
          <span className="flex items-center gap-1.5 text-13 text-text-secondary">
            <IconClockSmall size={14} />
            Codes change every 30 seconds. Use the newest one.
          </span>
        </div>
      </div>
      <div className="flex flex-none flex-col gap-2 px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
        <Button type="submit" loading={verify.isPending} disabled={!ready}>
          Verify and turn on
        </Button>
        <button
          type="button"
          disabled={restarting}
          onClick={restart}
          className="min-h-tap self-center text-14 font-semibold text-brand"
        >
          Code not working? Set up the app again
        </button>
      </div>
    </form>
  )
}
