package com.watchlog.api.service;

import com.watchlog.api.dto.CuratedContentDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CuratedContentService {
    /** Kept for installed clients; historical curator rows remain available only to admin reads. */
    public List<CuratedContentDto> listPublished(String language, int limit) {
        return List.of();
    }
}
