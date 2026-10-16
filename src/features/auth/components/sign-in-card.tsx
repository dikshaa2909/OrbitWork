"use client";

import { useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signUpWithGithub, signUpWithGoogle } from "@/lib/oauth";
import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

import { loginSchema } from "../schemas";
import { useLogin } from "../api/use-login";
import { useResetPassword } from "../api/use-reset-password";

export const SignInCard = () => {
  const { mutate, isPending } = useLogin();
  const { mutate: resetPassword, isPending: isResetting } = useResetPassword();
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    mutate({ json: values });
  };

  const onResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    resetPassword(
      { json: { email: resetEmail } },
      {
        onSuccess: () => {
          setIsResetOpen(false);
          setResetEmail("");
        },
      }
    );
  };

  return (
    <Card className="w-full h-full md:w-[487px] border-none shadow-none">
      <CardHeader className="flex items-center justify-center text-center p-7">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Welcome back to OrbitWork
        </CardTitle>
      </CardHeader>
      <div className="px-7">
        <DottedSeparator  />
      </div>
      <CardContent className="p-7">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Enter email address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Enter password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end -mt-2">
              <button
                type="button"
                onClick={() => setIsResetOpen(true)}
                className="text-xs text-blue-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Button disabled={isPending} size="lg" className="w-full">
              Login
            </Button>
          </form>
        </Form>
      </CardContent>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter the email address associated with your account and we&apos;ll send you a password reset link.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onResetSubmit} className="space-y-4 pt-2">
            <Input
              type="email"
              placeholder="name@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsResetOpen(false)}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isResetting || !resetEmail}>
                {isResetting ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <div className="px-7">
        <DottedSeparator />
      </div>
      <CardContent className="p-7 flex flex-col gap-y-4">
        <Button
          onClick={() => signUpWithGoogle()}
          disabled={isPending}
          variant="secondary"
          size="lg"
          className="w-full"
        >
          <FcGoogle className="mr-2 size-5" />
          Login with Google
        </Button>
        <Button
          onClick={() => signUpWithGithub()}
          disabled={isPending}
          variant="secondary"
          size="lg"
          className="w-full"
        >
          <FaGithub className="mr-2 size-5" />
          Login with Github
        </Button>
      </CardContent>
      <div className="px-7">
        <DottedSeparator />
      </div>
      <CardContent className="p-7 flex items-center justify-center">
        <p>
          Don&apos;t have an account?
          <Link href="/sign-up">
            <span className="text-blue-700">&nbsp;Sign Up</span>
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
