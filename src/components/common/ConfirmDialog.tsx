// Small confirmation dialog styled like the welcome message
export function ConfirmDialog({
  message,
  confirmLabel = 'OK',
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="welcome-overlay" onClick={onCancel}>
      <div className="welcome-dialog confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="welcome-close" onClick={onCancel}>
          &times;
        </button>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="welcome-btn confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="welcome-btn confirm-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
