import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', className, ...props }) => {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-semibold transition-all',
        variant === 'primary' && 'bg-blue-700 text-white hover:bg-blue-600 shadow-blue-700/30',
        variant === 'secondary' && 'bg-blue-900 text-blue-300 hover:bg-blue-800',
        variant === 'ghost' && 'bg-transparent text-blue-400 hover:bg-blue-800/40',
        className
      )}
      {...props}
    />
  );
};

export default Button;
