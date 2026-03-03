export interface WhatsAppConnection {
    phone_number_id: string;
    business_id: string;
    status: 'active' | 'error';
}

export interface WAContact {
    id: string;
    wa_id: string;
    phone_number: string;
    display_name: string;
    role: 'approver' | 'viewer' | 'admin';
    opted_in: boolean;
}

export interface WAEvent {
    id: string;
    event_type: 'message_sent' | 'message_received' | 'button_clicked' | 'template_sent';
    payload: any;
    created_at: string;
}

// WHATSAPP READY — NÃO ATIVAR
