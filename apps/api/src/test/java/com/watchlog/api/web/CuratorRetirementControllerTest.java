package com.watchlog.api.web;

import com.watchlog.api.service.CuratedContentAdminService;
import com.watchlog.api.service.CuratedContentService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CuratorRetirementControllerTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new CuratedContentController(new CuratedContentService()),
            new AdminCuratedContentController(new CuratedContentAdminService(jdbc, new ObjectMapper(), "admin-test")))
            .setControllerAdvice(new ApiExceptionHandler()).build();

    @Test
    void installedClientsReceiveAnUncachedEmptyArrayForBothLocales() throws Exception {
        for (String locale : new String[]{"ko", "en-US,en;q=0.9"}) {
            mvc.perform(get("/api/curated-contents").header("Accept-Language", locale).param("limit", "6"))
                    .andExpect(status().isOk()).andExpect(content().json("[]"))
                    .andExpect(header().string("Cache-Control", "no-store"));
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void formerAdminWriteRoutesReturnGoneWithoutTouchingTheDatabase() throws Exception {
        String id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
        mvc.perform(post("/internal/admin/curated-contents/drafts").header("X-Admin-Token", "admin-test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"titleId\":\"" + id + "\",\"locale\":\"ko\",\"body\":\"question\"}"))
                .andExpect(status().isGone());
        for (String action : new String[]{"publish", "disable"}) {
            mvc.perform(post("/internal/admin/curated-contents/" + id + "/" + action)
                            .header("X-Admin-Token", "admin-test"))
                    .andExpect(status().isGone());
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void invalidAdminTokenStillUsesTheExistingAuthenticationError() throws Exception {
        mvc.perform(post("/internal/admin/curated-contents/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/publish")
                        .header("X-Admin-Token", "wrong"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Invalid admin token"));
        verifyNoInteractions(jdbc);
    }
}
