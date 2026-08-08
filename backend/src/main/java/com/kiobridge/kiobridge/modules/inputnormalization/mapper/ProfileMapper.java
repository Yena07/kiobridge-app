package com.kiobridge.kiobridge.modules.inputnormalization.mapper;

import com.kiobridge.kiobridge.contracts.input.profile.Accessibility;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;
import com.kiobridge.kiobridge.contracts.input.profile.Consent;
import com.kiobridge.kiobridge.contracts.input.profile.DataClassification;
import com.kiobridge.kiobridge.contracts.input.profile.Interaction;
import com.kiobridge.kiobridge.contracts.input.profile.ProfileSource;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.ProfileInput;
import org.springframework.stereotype.Component;

@Component
public class ProfileMapper {

    public CanonicalProfile toCanonicalProfile(
            String teamId,
            ProfileInput input
    ) {
        return new CanonicalProfile(
                input.profileId(),
                input.displayName(),
                DataClassification.SYNTHETIC_PROFILE,
                new ProfileSource(
                        input.collectionChannel(),
                        teamId,
                        input.collectedAt()
                ),
                new Accessibility(
                        input.accessibility().largeText(),
                        input.accessibility().simpleSteps(),
                        input.accessibility().visualGuidance(),
                        input.accessibility().hearingSupport(),
                        input.accessibility().mobilitySupport(),
                        input.accessibility().highContrast(),
                        input.accessibility().staffAssistancePreferred()
                ),
                new Interaction(
                        input.interaction().preferredInput(),
                        input.interaction().language(),
                        input.interaction().confirmationRequired()
                ),
                new Consent(
                        input.consent().personalization(),
                        input.consent().retentionPolicy()
                )
        );
    }
}