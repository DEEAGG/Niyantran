import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertCircle, HelpCircle } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Regulatory Action',
  message = 'Are you sure you want to proceed with this compliance operation?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  isDestructive = false,
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md" showClose={!isLoading}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
          isDestructive
            ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
            : 'bg-accent/15 text-accent border-accent/30'
        }`}>
          {isDestructive ? (
            <AlertCircle className="w-5 h-5 stroke-[2]" />
          ) : (
            <HelpCircle className="w-5 h-5 stroke-[2]" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="text-base font-semibold text-text-primary">{title}</h4>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-border">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button
          variant={isDestructive ? 'danger' : confirmVariant}
          size="sm"
          isLoading={isLoading}
          onClick={onConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
