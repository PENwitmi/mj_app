import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        style: {
          background: 'white',
          color: '#1a1a1a',
          border: '1px solid #e5e7eb',
        },
        className: 'shadow-lg',
      }}
      {...props}
    />
  )
}

export { Toaster }
