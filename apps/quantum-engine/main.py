import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

# Qiskit imports
from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("qhe-engine")

app = FastAPI(
    title="genOS Quantum Heuristics Engine (QHE)",
    description="Motor de decisão assistido por heurísticas quânticas para o genOS v5.0",
    version="1.0.0"
)

# Request Models
class ContentFeatures(BaseModel):
    brand_alignment_score: float  # 0 to 1
    structural_integrity: float   # 0 to 1
    emotion_intensity: float      # 0 to 1
    clarity_score: float          # 0 to 1
    
class ScoringRequest(BaseModel):
    tenant_id: str
    post_id: str
    features: ContentFeatures

class ScoringResponse(BaseModel):
    quantum_engagement_score: float
    confidence: float
    circuit_depth: int

def build_qhe_circuit(features: ContentFeatures) -> QuantumCircuit:
    """
    Constrói um circuito quântico VQC simples que mapeia os atributos do texto
    para o estado quântico e aplica portas de rotação para calcular a interferência.
    """
    # 4 features -> 4 qubits
    qc = QuantumCircuit(4, 1)
    
    # Normalizamos as features para servir como angulos de rotacao em estado inicial (0 a PI)
    angles = [
        features.brand_alignment_score * np.pi,
        features.structural_integrity * np.pi,
        features.emotion_intensity * np.pi,
        features.clarity_score * np.pi
    ]
    
    # Feature map (Encoding clássico -> quântico)
    for i in range(4):
        qc.rx(angles[i], i)
        
    # Entanglement layer (Criando interferência entre os pilares)
    qc.cx(0, 1)
    qc.cx(1, 2)
    qc.cx(2, 3)
    qc.cx(3, 0)
    
    # Parameterized layer (Heurística base/Pesos fixos por enquanto)
    # TBD: Em versões futuras, esses ângulos serão treinados (VQC real)
    qc.ry(np.pi/4, 0)
    qc.ry(np.pi/4, 1)
    qc.ry(np.pi/4, 2)
    qc.ry(np.pi/4, 3)
    
    # Measure o qubit 0 para obter o expectation value (probabilidade de sucesso)
    qc.measure(0, 0)
    
    return qc

@app.post("/score", response_model=ScoringResponse)
async def score_content(req: ScoringRequest):
    try:
        logger.info(f"Processing QHE score for tenant {req.tenant_id}, post {req.post_id}")
        
        # 1. Build the Quantum Circuit
        qc = build_qhe_circuit(req.features)
        
        # 2. Simulate the circuit
        sampler = StatevectorSampler()
        # Qiskit V2 StatevectorSampler uses run([qc]) and returns PrimitiveJob
        job = sampler.run([qc], shots=1024)
        result = job.result()
        
        # Counts from the first PUB result, from the default classical register 'c'
        counts = result[0].data.c.get_counts()
        
        # Calculate probability of state '1'
        shots = sum(counts.values())
        p_success = counts.get('1', 0) / shots if shots > 0 else 0.0
        
        # Calibrando e normalizando o score final (Escala base para 0-100)
        # A interferência construtiva aumenta a probabilidade de 1
        q_score = float(p_success * 100)
        
        # Mix com a média clássica para garantir estabilidade (Decision Fusion inicial)
        classical_avg = (
            req.features.brand_alignment_score + 
            req.features.structural_integrity + 
            req.features.emotion_intensity + 
            req.features.clarity_score
        ) / 4.0 * 100
        
        # DFL: 70% Clássico, 30% Boost Quântico
        fusion_score = (classical_avg * 0.7) + (q_score * 0.3)
        
        # Clamp 0-100
        fusion_score = max(0.0, min(100.0, fusion_score))
        
        return ScoringResponse(
            quantum_engagement_score=round(fusion_score, 2),
            confidence=round(float(p_success), 4),
            circuit_depth=qc.depth()
        )
        
    except Exception as e:
        logger.error(f"Error in QHE circuit execution: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "online", "engine": "genOS QHE v1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
