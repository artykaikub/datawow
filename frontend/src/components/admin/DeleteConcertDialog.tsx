"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteConcertDialogProps {
  concertName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteConcertDialog({
  concertName,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteConcertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] text-center p-8 gap-0 rounded-2xl">
        <DialogHeader className="flex flex-col items-center gap-4 mb-5">
          <div className="size-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="size-8 text-red-400" strokeWidth={1.5} />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold mb-2">
              Delete Concert?
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-400">
              This action cannot be undone. This will permanently delete
              <span className="font-semibold text-foreground block mt-1">
                &ldquo;{concertName}&rdquo;
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="flex-row gap-3 sm:justify-center mt-2">
          <Button
            variant="outline"
            className="flex-1 h-10 rounded-xl border-gray-200"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Yes, Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
