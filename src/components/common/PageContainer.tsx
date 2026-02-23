import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`w-full px-8 py-6 animate-in fade-in duration-500 ${className}`}>
      {children}
    </div>
  );
};

export default PageContainer;
