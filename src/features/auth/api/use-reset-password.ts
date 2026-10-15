import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

interface ResetPasswordProps {
  json: {
    email: string;
  };
}

export const useResetPassword = () => {
  const mutation = useMutation<
    { success: boolean; message: string },
    Error,
    ResetPasswordProps
  >({
    mutationFn: async ({ json }) => {
      const response = await client.api.auth["reset-password"].$post({ json });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          (errorData as { error?: string })?.error || "Failed to send reset link"
        );
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "Password reset link sent to your email");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send reset link");
    },
  });

  return mutation;
};
