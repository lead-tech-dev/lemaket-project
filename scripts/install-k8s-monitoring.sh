#!/usr/bin/env bash

set -euo pipefail

MON_NS="${MONITORING_NAMESPACE:-monitoring}"
GRAFANA_NODEPORT="${GRAFANA_NODEPORT:-32300}"
PROM_NODEPORT="${PROM_NODEPORT:-32301}"
ALERTMGR_NODEPORT="${ALERTMGR_NODEPORT:-32303}"
GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-}"

detect_tools() {
  if kubectl version --client >/dev/null 2>&1 && kubectl get namespace default >/dev/null 2>&1; then
    KCTL=(kubectl)
    HLM=(helm)
  elif sudo -n k3s kubectl version --client >/dev/null 2>&1; then
    KCTL=(sudo -n k3s kubectl)
    HLM=(sudo -n env KUBECONFIG=/etc/rancher/k3s/k3s.yaml helm)
  elif [[ -t 0 ]] && sudo k3s kubectl version --client >/dev/null 2>&1; then
    KCTL=(sudo k3s kubectl)
    HLM=(sudo env KUBECONFIG=/etc/rancher/k3s/k3s.yaml helm)
  else
    echo "No Kubernetes access. Configure kubectl or allow passwordless sudo for k3s kubectl." >&2
    exit 1
  fi
}

generate_password_if_needed() {
  if [[ -z "$GRAFANA_ADMIN_PASSWORD" ]]; then
    GRAFANA_ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '\n' | tr '/' '_' | tr '+' '-')"
  fi
}

install_charts() {
  "${HLM[@]}" repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
  "${HLM[@]}" repo add grafana https://grafana.github.io/helm-charts >/dev/null
  "${HLM[@]}" repo update >/dev/null

  "${KCTL[@]}" get namespace "$MON_NS" >/dev/null 2>&1 || "${KCTL[@]}" create namespace "$MON_NS"

  "${HLM[@]}" upgrade --install monitoring prometheus-community/kube-prometheus-stack \
    -n "$MON_NS" \
    -f deploy/k8s/monitoring/values-kube-prometheus-stack.yaml \
    --set grafana.adminPassword="$GRAFANA_ADMIN_PASSWORD" \
    --set grafana.service.nodePort="$GRAFANA_NODEPORT" \
    --set prometheus.service.nodePort="$PROM_NODEPORT" \
    --set alertmanager.service.nodePort="$ALERTMGR_NODEPORT" \
    --wait --timeout 15m

  "${HLM[@]}" upgrade --install blackbox prometheus-community/prometheus-blackbox-exporter \
    -n "$MON_NS" \
    -f deploy/k8s/monitoring/values-blackbox.yaml \
    --wait --timeout 10m

  "${HLM[@]}" upgrade --install loki grafana/loki \
    -n "$MON_NS" \
    -f deploy/k8s/monitoring/values-loki.yaml \
    --wait --timeout 15m

  "${HLM[@]}" upgrade --install promtail grafana/promtail \
    -n "$MON_NS" \
    -f deploy/k8s/monitoring/values-promtail.yaml \
    --wait --timeout 10m
}

apply_monitoring_manifests() {
  "${KCTL[@]}" apply -f deploy/k8s/monitoring/probes.yaml
  "${KCTL[@]}" apply -f deploy/k8s/monitoring/rules.yaml
  "${KCTL[@]}" apply -f deploy/k8s/monitoring/grafana-dashboard-sandaga-overview.yaml
}

print_summary() {
  echo
  echo "Monitoring stack installed in namespace: ${MON_NS}"
  echo "Grafana NodePort:      ${GRAFANA_NODEPORT}"
  echo "Prometheus NodePort:   ${PROM_NODEPORT}"
  echo "Alertmanager NodePort: ${ALERTMGR_NODEPORT}"
  echo "Grafana admin user:    admin"
  echo "Grafana admin password: ${GRAFANA_ADMIN_PASSWORD}"
  echo
  echo "Quick checks:"
  echo "  ${KCTL[*]} -n ${MON_NS} get pods"
  echo "  curl -I http://127.0.0.1:${GRAFANA_NODEPORT}"
  echo "  curl -I http://127.0.0.1:${PROM_NODEPORT}"
}

main() {
  detect_tools
  generate_password_if_needed
  install_charts
  apply_monitoring_manifests
  print_summary
}

main "$@"
