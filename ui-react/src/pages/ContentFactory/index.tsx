import React from 'react';
import MatrixList from '../../components/ContentFactory/MatrixList';
import '../../styles/content-factory.css';

export default function ContentFactory() {
    return (
        <div className="content-factory-page" style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
            <MatrixList />
        </div>
    );
}
