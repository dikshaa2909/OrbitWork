"use client";

import { ResponsiveModal } from "@/components/responsive-modal";

import { CreateSprintForm } from "./create-sprint-form";
import { useCreateSprintModal } from "../hooks/use-create-sprint-modal";

export const CreateSprintModal = () => {
  const { isOpen, setIsOpen, close } = useCreateSprintModal();

  return (
    <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
      <CreateSprintForm onCancel={close} />
    </ResponsiveModal>
  );
};
