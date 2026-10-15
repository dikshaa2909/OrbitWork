import { useQueryState, parseAsBoolean } from "nuqs";

export const useCreateSprintModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "create-sprint",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
  );

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    isOpen,
    open,
    close,
    setIsOpen,
  };
};
