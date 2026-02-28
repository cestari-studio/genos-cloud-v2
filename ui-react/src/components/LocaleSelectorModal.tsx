import React, { useState } from 'react';
import {
    ComposedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Tile,
    Grid,
    Column,
    Tag,
    Button,
} from '@carbon/react';
import { Earth, EarthAmericas, EarthEuropeAfrica } from '@carbon/icons-react';

interface LocaleSelectorModalProps {
    open: boolean;
    onClose: () => void;
    tenantName: string;
}

const LOCALES = [
    { id: 'na', name: 'Norte América', currency: 'USD', lang: 'English', active: true },
    { id: 'br', name: 'Brasil (LATAM)', currency: 'BRL', lang: 'Português', active: false },
    { id: 'eu', name: 'Europa', currency: 'EUR', lang: 'English/EU', active: false },
];

export default function LocaleSelectorModal({ open, onClose, tenantName }: LocaleSelectorModalProps) {
    const [selected, setSelected] = useState('na');

    const handleSave = () => {
        // Mock save logic, fecharia o modal e poderia dar refresh na session
        onClose();
    };

    return (
        <ComposedModal open={open} onClose={onClose} preventCloseOnClickOutside size="sm">
            <ModalHeader title="Configuração Regional do Master Tenant" closeModal={onClose} />
            <ModalBody>
                <p className="cds--type-body-short-01" style={{ marginBottom: '1.5rem', color: '#c6c6c6' }}>
                    Defina o locale primário para <strong>{tenantName}</strong>. Isso forçará o Stripe Billing
                    e as estimativas de custo LLM (Tokens) do Dashboard a utilizarem a moeda do respectivo Gateway.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {LOCALES.map((loc) => (
                        <Tile
                            key={loc.id}
                            onClick={() => setSelected(loc.id)}
                            style={{
                                backgroundColor: selected === loc.id ? '#393939' : '#262626',
                                border: selected === loc.id ? '1px solid #0f62fe' : '1px solid #393939',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                margin: 0
                            }}
                        >
                            <Earth size={24} fill={selected === loc.id ? '#0f62fe' : '#8d8d8d'} />
                            <div style={{ flex: 1 }}>
                                <h4 className="cds--type-productive-heading-01" style={{ color: '#f4f4f4' }}>{loc.name}</h4>
                                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                                    <Tag size="sm" type="blue">{loc.currency}</Tag>
                                    <Tag size="sm" type="cool-gray">{loc.lang}</Tag>
                                </div>
                            </div>
                        </Tile>
                    ))}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button kind="secondary" onClick={onClose}>Cancelar</Button>
                <Button kind="primary" onClick={handleSave}>Salvar Regionalização</Button>
            </ModalFooter>
        </ComposedModal>
    );
}
