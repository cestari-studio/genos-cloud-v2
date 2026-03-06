import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ActionableNotification, Stack } from '@carbon/react';
import { supabase } from '../../services/supabase';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * genOS™ v5.0.0 — Global Error Boundary
 * Captures catastrophic failures and logs to system_logs.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('genOS Global Error Caught:', error, errorInfo);
        this.logErrorToSupabase(error, errorInfo);
    }

    private async logErrorToSupabase(error: Error, errorInfo: ErrorInfo) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('system_logs').insert({
                level: 'CRITICAL',
                module: 'React-Boundary',
                message: error.message,
                stack_trace: error.stack,
                metadata: {
                    componentStack: errorInfo.componentStack,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    tenant_id: user?.app_metadata?.tenant_id
                }
            });
        } catch (err) {
            console.error('Failed to log error to system_logs:', err);
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '4rem',
                    backgroundColor: '#161616',
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Stack gap={7} style={{ maxWidth: '600px' }}>
                        <h1 className="cds--type-productive-heading-05" style={{ color: '#f4f4f4' }}>
                            genOS™ <span style={{ fontWeight: 600 }}>System Halt</span>
                        </h1>
                        <ActionableNotification
                            kind="error"
                            title="Catastrophic Failure Detected"
                            subtitle="The system encountered a fatal error. Our engineers (and AI) have been notified via telemetry."
                            inline={false}
                            actionButtonLabel="Reload Dashboard"
                            onActionButtonClick={() => window.location.reload()}
                            hideCloseButton
                        />
                        <div style={{
                            padding: '1rem',
                            backgroundColor: '#262626',
                            border: '1px solid #393939',
                            borderRadius: '2px'
                        }}>
                            <p className="cds--type-label-01" style={{ color: '#a8a8a8', marginBottom: '0.5rem' }}>INTERNAL STACK TRACE</p>
                            <pre style={{
                                color: '#fa4d56',
                                fontSize: '0.75rem',
                                whiteSpace: 'pre-wrap',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {this.state.error?.stack}
                            </pre>
                        </div>
                    </Stack>
                </div>
            );
        }

        return this.props.children;
    }
}
