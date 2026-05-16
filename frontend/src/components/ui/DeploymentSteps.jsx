import React from 'react';
import { Check, Loader } from 'lucide-react';

const STAGES = [
  { key: 'queued',    label: 'Queued',     desc: 'Deployment in queue' },
  { key: 'preparing', label: 'Preparing',  desc: 'Setting up environment' },
  { key: 'creating_repository', label: 'Repo Setup', desc: 'Provisioning remote repo' },
  { key: 'pushing_code', label: 'Pushing', desc: 'Pushing source code' },
  { key: 'provisioning', label: 'Provisioning', desc: 'Provisioning provider resources' },
  { key: 'building',  label: 'Building',   desc: 'Installing dependencies & building' },
  { key: 'deploying', label: 'Deploying',  desc: 'Deploying artifacts' },
  { key: 'verifying', label: 'Verifying',  desc: 'Running health checks' },
  { key: 'completed', label: 'Live',       desc: 'Deployment complete' },
];

const ORDER = STAGES.map(s => s.key);

function getStageStatus(stageKey, currentStatus) {
  if (currentStatus === 'failed') return stageKey === 'queued' ? 'completed' : 'pending';
  const curr = ORDER.indexOf(currentStatus);
  const idx  = ORDER.indexOf(stageKey);
  if (curr === -1) return 'pending';
  if (idx < curr) return 'completed';
  if (idx === curr) return 'active';
  return 'pending';
}

export default function DeploymentSteps({ status }) {
  return (
    <div className="deploy-steps" data-testid="deploy-steps" aria-label="Deployment pipeline stages">
      {STAGES.map((stage) => {
        const s = getStageStatus(stage.key, status);
        return (
          <div key={stage.key} className={`deploy-step ${s}`} data-testid={`deploy-step-${stage.key}`} data-status={s} aria-label={`${stage.label}: ${s}`}>
            <div className={`step-icon ${s}`}>
              {s === 'completed' ? <Check size={11} /> :
               s === 'active'    ? <Loader size={11} className="spin" /> :
               null}
            </div>
            <div className="step-content">
              <div className="step-name">{stage.label}</div>
              <div className="step-desc">{stage.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
