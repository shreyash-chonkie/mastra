'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { AutoForm } from '@/components/ui/autoform';
import { ExtendableAutoFormProps } from '@autoform/react';
import z from 'zod';
import { ZodProvider } from '@autoform/zod';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit: (values: z.infer<T>) => void | Promise<void>;
  defaultValues?: z.infer<T>;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
}

export function DynamicForm<T extends z.ZodSchema>({
  schema,
  onSubmit,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel = 'Submit',
}: DynamicFormProps<T>) {
  const schemaProvider = new ZodProvider(schema as any);

  const formProps: ExtendableAutoFormProps<z.infer<T>> = {
    schema: schemaProvider,
    onSubmit,
    defaultValues,
    formProps: {
      className: 'space-y-4',
    },
    uiComponents: {
      SubmitButton: ({ children }) => (
        <Button type="submit" disabled={isSubmitLoading}>
          {isSubmitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children || submitButtonLabel}
        </Button>
      ),
    },
  };

  return (
    <ScrollArea className="h-full w-full">
      <AutoForm {...formProps} />
    </ScrollArea>
  );
}
