import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { Theme } from '@carbon/react';

interface MermaidChartProps {
    chart: string;
    id?: string;
    theme?: 'dark' | 'default';
}

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif',
    themeVariables: {
        primaryColor: '#0f62fe',
        primaryTextColor: '#f4f4f4',
        primaryBorderColor: '#onn62fe',
        lineColor: '#c6c6c6',
        secondaryColor: '#393939',
        tertiaryColor: '#262626',
        nodeBorder: '#393939',
        mainBkg: '#262626',
        titleColor: '#f4f4f4',
        edgeLabelBackground: '#161616',
    }
});

export default function MermaidChart({ chart, id = 'mermaid-chart', theme = 'dark' }: MermaidChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({ theme: theme === 'dark' ? 'dark' : 'default' });
        const renderChart = async () => {
            if (containerRef.current && chart) {
                try {
                    const { svg } = await mermaid.render(id, chart);
                    containerRef.current.innerHTML = svg;
                } catch (error) {
                    console.error('Error rendering mermaid chart:', error);
                    if (containerRef.current) {
                        containerRef.current.innerHTML = `<p style="color: #fa4d56;">Graph syntax error or unable to render.</p>`;
                    }
                }
            }
        };
        renderChart();
    }, [chart, id, theme]);

    return (
        <div
            ref={containerRef}
            className="mermaid-wrapper"
            style={{
                width: '100%',
                overflowX: 'auto',
                backgroundColor: '#161616',
                padding: '2rem',
                borderRadius: '0.25rem',
                border: '1px solid #393939',
                display: 'flex',
                justifyContent: 'center'
            }}
        />
    );
}
