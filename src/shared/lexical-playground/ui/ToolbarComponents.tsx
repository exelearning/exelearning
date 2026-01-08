/**
 * Toolbar UI Components
 */
import React from 'react';

interface ToolbarButtonProps {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title?: string;
    icon: React.ReactNode;
    className?: string;
}

export function ToolbarButton({
    onClick,
    active = false,
    disabled = false,
    title,
    icon,
    className = '',
}: ToolbarButtonProps) {
    return (
        <button
            type="button"
            className={`lexical-playground-toolbar-btn ${active ? 'active' : ''} ${className}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            aria-pressed={active}
        >
            {icon}
        </button>
    );
}

export function ToolbarDivider() {
    return <div className="divider lexical-playground-toolbar-divider" />;
}
