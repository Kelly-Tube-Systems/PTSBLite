import { useEffect, useState } from "react";
import { Icons } from "@/components/Icons";
import { Modal } from "@/components/Modal";
import type { DesktopBridge } from "@/platform/desktop";
import "@/components/UpdatePrompt.css";

export type UpdatePromptProps = {
  updates: DesktopBridge;
};

/**
 * The Windows app's offer to restart into an update it has downloaded
 * (ADR-0051). Nothing shows until one has. "Later" leaves the update to install
 * the next time the app closes, and the offer does not come back until the app
 * is next opened.
 */
export function UpdatePrompt({ updates }: UpdatePromptProps) {
  const [version, setVersion] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void updates.updateReady().then((ready) => {
      if (mounted) setVersion(ready);
    });
    return () => {
      mounted = false;
    };
  }, [updates]);

  if (version === null) return null;

  const later = () => setVersion(null);
  const restart = () => {
    setRestarting(true);
    void updates.installUpdate();
  };

  return (
    // Not dismissed by a stray click on the backdrop: the offer does not come
    // back this session.
    <Modal label="Update ready" onClose={later} size="sm" dismissOnBackdrop={false}>
      <div className="modal__header">
        <span className="update-prompt__icon">
          <Icons.Download size={15} />
        </span>
        <div className="modal__title">Update ready</div>
        <div className="modal__spacer" />
        <button onClick={later} className="icon-btn" aria-label="Close">
          <Icons.Close size={14} />
        </button>
      </div>

      <div className="update-prompt__message">
        <p className="update-prompt__lead">PTSBLite {version} is ready to install.</p>
        <p>
          Restart now to update. Your design is saved and will be there when PTSBLite reopens. If
          you choose Later, the update installs the next time you close PTSBLite.
        </p>
      </div>

      <div className="modal__actions">
        <button className="topbtn" onClick={later} disabled={restarting}>
          Later
        </button>
        <button className="topbtn primary" onClick={restart} disabled={restarting} autoFocus>
          {restarting ? "Restarting…" : "Restart now"}
        </button>
      </div>
    </Modal>
  );
}
