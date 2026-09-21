'use client';

import React, { useState } from 'react';
import { Sparkles, Coins, ShoppingBag, X, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { POWERS, type PowerId } from '@/lib/combat';
import {
  POWER_STORE_CATALOG,
  POWER_UNLOCK_COSTS,
  buyPowerCharges,
  unlockPowerWithCoins,
  DEFAULT_POWER_CHARGES,
} from '@/lib/progression';
import type { LevelProgress } from '@/lib/types';

interface PowerStoreModalProps {
  progress: LevelProgress;
  onUpdateProgress: (updated: LevelProgress) => void;
  onClose: () => void;
  onPlaySfx?: (sound: 'coin' | 'power' | 'hit') => void;
}

export function PowerStoreModal({
  progress,
  onUpdateProgress,
  onClose,
  onPlaySfx,
}: PowerStoreModalProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const coins = progress.coins ?? 0;
  const charges = progress.powerCharges ?? DEFAULT_POWER_CHARGES;
  const unlocked = progress.unlockedPowers ?? ['flame_burst'];

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleBuyCharges = (powerId: PowerId, amount: number, cost: number) => {
    const res = buyPowerCharges(progress, powerId, amount, cost);
    if (res.success) {
      onPlaySfx?.('coin');
      onUpdateProgress(res.progress);
      showToast(`¡Recargaste +${amount} cargas para ${POWERS[powerId]?.name}!`, 'success');
    } else {
      onPlaySfx?.('hit');
      showToast(res.reason || 'Monedas insuficientes', 'error');
    }
  };

  const handleUnlockPower = (powerId: PowerId, cost: number) => {
    const res = unlockPowerWithCoins(progress, powerId, cost);
    if (res.success) {
      onPlaySfx?.('power');
      onUpdateProgress(res.progress);
      showToast(`¡Desbloqueaste el poder legendario ${POWERS[powerId]?.name}!`, 'success');
    } else {
      onPlaySfx?.('hit');
      showToast(res.reason || 'Monedas insuficientes', 'error');
    }
  };

  return (
    <div className="game-overlay power-store-backdrop" role="dialog" aria-modal="true">
      <div className="power-store-modal">
        {/* Header */}
        <div className="power-store-header">
          <div className="power-store-title-group">
            <span className="store-badge-icon">
              <ShoppingBag size={28} />
            </span>
            <div>
              <h2>Bazar de Poderes Mágicos</h2>
              <p>Canjea tus monedas recolectadas por cargas y nuevos hechizos</p>
            </div>
          </div>

          <div className="store-wallet-pill">
            <Coins size={22} className="text-yellow-400" />
            <span className="wallet-amount">{coins}</span>
            <small>Monedas</small>
          </div>

          <button
            type="button"
            className="store-close-btn"
            onClick={onClose}
            aria-label="Cerrar tienda"
          >
            <X size={22} />
          </button>
        </div>

        {/* Feedback Toast */}
        {toastMessage && (
          <div className={`store-feedback-toast ${toastType}`}>
            {toastType === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Store Catalog Grid */}
        <div className="power-store-grid">
          {(Object.keys(POWERS) as PowerId[]).map((powerId) => {
            const power = POWERS[powerId];
            const isUnlocked = unlocked.includes(powerId);
            const unlockCost = POWER_UNLOCK_COSTS[powerId] ?? 100;
            const currentAmmo = charges[powerId] ?? 0;
            const packages = POWER_STORE_CATALOG.filter((pkg) => pkg.powerId === powerId);

            return (
              <div
                key={powerId}
                className={`power-store-card ${!isUnlocked ? 'is-locked' : ''}`}
                style={{ borderTopColor: power.color }}
              >
                <div className="card-top-row">
                  <div
                    className="power-avatar-circle"
                    style={{
                      background: `radial-gradient(circle, ${power.color} 0%, rgba(15, 23, 42, 0.9) 100%)`,
                      boxShadow: `0 0 16px ${power.glowColor}`,
                    }}
                  >
                    <span>{power.icon}</span>
                  </div>
                  <div className="power-card-meta">
                    <div className="name-and-element">
                      <h3>{power.name}</h3>
                      <span className="element-chip">{power.element}</span>
                    </div>
                    <p className="power-card-desc">{power.description}</p>
                  </div>
                </div>

                <div className="power-card-stats">
                  <span>Daño base: <strong>{power.damage}</strong></span>
                  <span>Velocidad: <strong>{power.speed}</strong></span>
                </div>

                {/* Ammo & Actions */}
                <div className="power-card-actions">
                  {isUnlocked ? (
                    <>
                      <div className="current-ammo-indicator">
                        <span>Cargas disponibles:</span>
                        <strong className={currentAmmo <= 2 ? 'low-ammo' : ''}>
                          {currentAmmo}
                        </strong>
                      </div>
                      <div className="refill-buttons-row">
                        {packages.map((pkg) => (
                          <button
                            key={pkg.id}
                            type="button"
                            className="refill-pack-btn"
                            disabled={coins < pkg.cost}
                            onClick={() => handleBuyCharges(powerId, pkg.charges, pkg.cost)}
                          >
                            <span className="pack-label">{pkg.label}</span>
                            <span className="pack-cost">
                              <Coins size={14} /> {pkg.cost}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="locked-power-action">
                      <div className="lock-info">
                        <Sparkles size={16} /> Poder Legendario Bloqueado
                      </div>
                      <button
                        type="button"
                        className="unlock-power-btn"
                        disabled={coins < unlockCost}
                        onClick={() => handleUnlockPower(powerId, unlockCost)}
                      >
                        <span>Desbloquear Poder</span>
                        <span className="unlock-cost">
                          <Coins size={16} /> {unlockCost}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="power-store-footer">
          <p>
            💡 <em>Consejo: Encuentra orbes elementales en la pista de carrera para recargar +3 cargas gratis.</em>
          </p>
          <button type="button" className="store-done-btn" onClick={onClose}>
            ¡Listo para Correr!
          </button>
        </div>
      </div>
    </div>
  );
}
