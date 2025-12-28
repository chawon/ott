package com.watchlog.api.web;

import com.watchlog.api.dto.RecommendationDto;
import com.watchlog.api.dto.TitleDto;
import com.watchlog.api.service.RecommendationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping
    public RecommendationDto get(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        List<TitleDto> items = recommendationService.recommend(limit);
        return new RecommendationDto(items, "genre-overlap from your high-rated DONE logs");
    }
}
