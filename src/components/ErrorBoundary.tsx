import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
                    <div className="max-w-xl w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl">
                        <h1 className="text-3xl font-black text-red-500 mb-4">Algo correu mal.</h1>
                        <p className="text-slate-400 mb-6">Ocorreu um erro crítico na aplicação. Por favor contacte o suporte com esta mensagem:</p>

                        <div className="bg-black/50 p-4 rounded-xl border border-white/10 overflow-auto max-h-64 mb-6 custom-scrollbar">
                            <p className="font-mono text-red-400 text-sm mb-2 font-bold">
                                {this.state.error?.toString()}
                            </p>
                            {this.state.errorInfo && (
                                <pre className="font-mono text-slate-500 text-xs whitespace-pre-wrap">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>

                        <button 
                            onClick={() => window.location.href = '/'}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
                        >
                            Tentar Recarregar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}


