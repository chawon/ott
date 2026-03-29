package com.watchlog.api.service;

import com.watchlog.api.dto.DailyReportDto.K8sStatusDto;
import com.watchlog.api.dto.DailyReportDto.PodStatusDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder;
import org.apache.hc.core5.ssl.SSLContextBuilder;
import org.apache.hc.core5.ssl.TrustStrategy;
import javax.net.ssl.SSLContext;
import java.security.cert.X509Certificate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class KubernetesStatusService {

    private static final Logger log = LoggerFactory.getLogger(KubernetesStatusService.class);
    private static final String TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
    private static final String NAMESPACE = "ott";

    public K8sStatusDto fetchStatus() {
        try {
            String token = readToken();
            String apiServer = resolveApiServer();

            // Create a RestClient that ignores SSL certificates for internal K8s API
            TrustStrategy acceptingTrustStrategy = (X509Certificate[] chain, String authType) -> true;
            SSLContext sslContext = SSLContextBuilder.create()
                    .loadTrustMaterial(null, acceptingTrustStrategy)
                    .build();

            var cm = PoolingHttpClientConnectionManagerBuilder.create()
                    .setSSLSocketFactory(SSLConnectionSocketFactoryBuilder.create()
                            .setSslContext(sslContext)
                            .build())
                    .build();

            var httpClient = HttpClients.custom()
                    .setConnectionManager(cm)
                    .build();

            var factory = new HttpComponentsClientHttpRequestFactory(httpClient);

            var client = RestClient.builder()
                    .requestFactory(factory)
                    .baseUrl(apiServer)
                    .defaultHeader("Authorization", "Bearer " + token)
                    .build();

            List<PodStatusDto> pods = fetchPods(client);
            enrichWithMetrics(client, pods);
            return new K8sStatusDto(pods, null);
        } catch (Exception e) {
            log.warn("Kubernetes API call failed", e);
            return new K8sStatusDto(List.of(), e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private List<PodStatusDto> fetchPods(RestClient client) {
        Map<String, Object> podList = client.get()
                .uri("/api/v1/namespaces/{ns}/pods", NAMESPACE)
                .retrieve()
                .body(Map.class);

        List<Map<String, Object>> items = (List<Map<String, Object>>) podList.get("items");
        if (items == null) return List.of();

        List<PodStatusDto> result = new ArrayList<>();
        for (var item : items) {
            var metadata = (Map<String, Object>) item.get("metadata");
            var status = (Map<String, Object>) item.get("status");
            var spec = (Map<String, Object>) item.get("spec");

            String name = (String) metadata.get("name");
            String phase = (String) status.get("phase");
            String imageTag = extractImageTag(spec);

            result.add(new PodStatusDto(name, phase, imageTag, null, null));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private void enrichWithMetrics(RestClient client, List<PodStatusDto> pods) {
        try {
            Map<String, Object> metricsList = client.get()
                    .uri("/apis/metrics.k8s.io/v1beta1/namespaces/{ns}/pods", NAMESPACE)
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> items = (List<Map<String, Object>>) metricsList.get("items");
            if (items == null) return;

            for (var metric : items) {
                var metadata = (Map<String, Object>) metric.get("metadata");
                String metricName = (String) metadata.get("name");

                var containers = (List<Map<String, Object>>) metric.get("containers");
                if (containers == null || containers.isEmpty()) continue;

                String cpu = (String) ((Map<String, Object>) containers.get(0).get("usage")).get("cpu");
                String mem = (String) ((Map<String, Object>) containers.get(0).get("usage")).get("memory");

                for (int i = 0; i < pods.size(); i++) {
                    if (pods.get(i).name().startsWith(metricName.substring(0, Math.min(metricName.length(), 15)))) {
                        pods.set(i, new PodStatusDto(
                                pods.get(i).name(), pods.get(i).phase(), pods.get(i).imageTag(),
                                formatCpu(cpu), formatMem(mem)
                        ));
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Metrics server not available: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private String extractImageTag(Map<String, Object> spec) {
        try {
            var containers = (List<Map<String, Object>>) spec.get("containers");
            if (containers == null || containers.isEmpty()) return "unknown";
            String image = (String) containers.get(0).get("image");
            int colon = image.lastIndexOf(':');
            if (colon < 0) return image;
            String tag = image.substring(colon + 1);
            return tag.length() > 12 ? tag.substring(0, 12) : tag;
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String formatCpu(String cpu) {
        if (cpu == null) return null;
        if (cpu.endsWith("n")) {
            long nanos = Long.parseLong(cpu.replace("n", ""));
            return String.format("%.1fm", nanos / 1_000_000.0);
        }
        return cpu;
    }

    private String formatMem(String mem) {
        if (mem == null) return null;
        if (mem.endsWith("Ki")) {
            long ki = Long.parseLong(mem.replace("Ki", ""));
            return String.format("%.0fMi", ki / 1024.0);
        }
        return mem;
    }

    private String readToken() throws IOException {
        return Files.readString(Path.of(TOKEN_PATH), StandardCharsets.UTF_8).strip();
    }

    private String resolveApiServer() {
        String host = System.getenv("KUBERNETES_SERVICE_HOST");
        String port = System.getenv("KUBERNETES_SERVICE_PORT");
        if (host != null && port != null) {
            return "https://" + host + ":" + port;
        }
        return "https://kubernetes.default.svc";
    }
}
