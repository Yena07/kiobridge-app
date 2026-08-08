package com.kiobridge.kiobridge.modules.inputnormalization.mapper;

import com.kiobridge.kiobridge.contracts.input.profile.CollectionChannel;
import com.kiobridge.kiobridge.contracts.input.profile.DataClassification;
import com.kiobridge.kiobridge.contracts.input.profile.PreferredInput;
import com.kiobridge.kiobridge.contracts.input.profile.RetentionPolicy;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.AccessibilityInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.ConsentInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.InteractionInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.ProfileInput;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ProfileMapperTest {

    private final ProfileMapper mapper = new ProfileMapper();

    @Test
    void 원본_입력을_CanonicalProfile로_변환한다() {
        ProfileInput input = new ProfileInput(
                "WHATTHEBUG-PROFILE-001",
                "합성 사용자 1",
                CollectionChannel.WEB_FORM,
                Instant.parse("2026-08-01T05:30:00Z"),
                new AccessibilityInput(
                        true,
                        true,
                        false,
                        false,
                        false,
                        true,
                        false
                ),
                new InteractionInput(
                        PreferredInput.TOUCH,
                        "ko-KR",
                        true
                ),
                new ConsentInput(
                        false,
                        RetentionPolicy.SESSION_ONLY
                )
        );

        var profile = mapper.toCanonicalProfile(
                "WHATTHEBUG",
                input
        );

        assertThat(profile.profileId())
                .isEqualTo("WHATTHEBUG-PROFILE-001");

        assertThat(profile.dataClassification())
                .isEqualTo(DataClassification.SYNTHETIC_PROFILE);

        assertThat(profile.source().providerId())
                .isEqualTo("WHATTHEBUG");

        assertThat(profile.source().collectionChannel())
                .isEqualTo(CollectionChannel.WEB_FORM);

        assertThat(profile.accessibility().largeText())
                .isTrue();

        assertThat(profile.interaction().language())
                .isEqualTo("ko-KR");

        assertThat(profile.consent().retentionPolicy())
                .isEqualTo(RetentionPolicy.SESSION_ONLY);
    }
}