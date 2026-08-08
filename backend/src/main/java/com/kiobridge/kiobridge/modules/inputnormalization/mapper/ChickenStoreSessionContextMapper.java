package com.kiobridge.kiobridge.modules.inputnormalization.mapper;

import com.kiobridge.kiobridge.contracts.input.context.AllergenId;
import com.kiobridge.kiobridge.contracts.input.context.BoneType;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreCapabilities;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreFacts;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreHardConstraints;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStorePreferences;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.context.CupOption;
import com.kiobridge.kiobridge.contracts.input.context.FieldMetadata;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SessionIntent;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class ChickenStoreSessionContextMapper {

    private static final String NORMALIZER_ID =
            "chicken-store-context-normalizer-v1";

    public ChickenStoreSessionContext toSessionContext(
            SessionContextNormalizationRequest request
    ) {
        var input = request.contextInput();

        ServiceType serviceType =
                mapServiceType(input.serviceType());
        SpicyLevel spicyLevel =
                mapSpicyLevel(input.spicyLevel());
        BoneType boneType =
                mapBoneType(input.boneType());
        CupOption cupOption =
                mapCupOption(input.cupOption());
        List<AllergenId> allergenIds =
                mapAllergenIds(input.allergenIds());

        var preferences = new ChickenStorePreferences(
                serviceType,
                spicyLevel,
                boneType,
                cupOption,
                input.quantity()
        );

        var hardConstraints =
                new ChickenStoreHardConstraints(
                        allergenIds,
                        input.maxPriceKrw()
                );

        return new ChickenStoreSessionContext(
                new SessionIntent(SessionTask.ORDER_FOOD),
                new ChickenStoreFacts(),
                preferences,
                hardConstraints,
                new ChickenStoreCapabilities(),
                buildFieldMetadata(request)
        );
    }

    private Map<String, FieldMetadata> buildFieldMetadata(
            SessionContextNormalizationRequest request
    ) {
        var input = request.contextInput();
        var source = request.collectionMetadata();

        var metadata = new FieldMetadata(
                source.source(),
                source.confidence(),
                source.confirmedByUser(),
                source.capturedAt(),
                NORMALIZER_ID,
                null
        );

        Map<String, FieldMetadata> result =
                new LinkedHashMap<>();

        putIfProvided(
                result,
                "/preferences/serviceType",
                input.serviceType(),
                metadata
        );
        putIfProvided(
                result,
                "/preferences/spicyLevel",
                input.spicyLevel(),
                metadata
        );
        putIfProvided(
                result,
                "/preferences/boneType",
                input.boneType(),
                metadata
        );
        putIfProvided(
                result,
                "/preferences/cupOption",
                input.cupOption(),
                metadata
        );
        putIfProvided(
                result,
                "/preferences/quantity",
                input.quantity(),
                metadata
        );
        putIfProvided(
                result,
                "/hardConstraints/allergenIds",
                input.allergenIds(),
                metadata
        );
        putIfProvided(
                result,
                "/hardConstraints/maxPriceKrw",
                input.maxPriceKrw(),
                metadata
        );

        return result;
    }

    private void putIfProvided(
            Map<String, FieldMetadata> result,
            String path,
            Object value,
            FieldMetadata metadata
    ) {
        if (value == null) {
            return;
        }

        if (value instanceof String stringValue
                && stringValue.isBlank()) {
            return;
        }

        result.put(path, metadata);
    }

    private ServiceType mapServiceType(String rawValue) {
        if (isMissing(rawValue)) {
            return null;
        }

        return switch (normalize(rawValue)) {
            case "매장", "매장에서", "DINE_IN" ->
                    ServiceType.DINE_IN;
            case "포장", "테이크아웃", "TAKE_OUT" ->
                    ServiceType.TAKE_OUT;
            case "상관없음", "선호없음", "NO_PREFERENCE" ->
                    ServiceType.NO_PREFERENCE;
            default -> ServiceType.UNKNOWN;
        };
    }

    private SpicyLevel mapSpicyLevel(String rawValue) {
        if (isMissing(rawValue)) {
            return null;
        }

        return switch (normalize(rawValue)) {
            case "순한맛", "안매운맛", "MILD" ->
                    SpicyLevel.MILD;
            case "보통맛", "MEDIUM" ->
                    SpicyLevel.MEDIUM;
            case "매운맛", "맵게", "HOT" ->
                    SpicyLevel.HOT;
            case "상관없음", "선호없음", "NO_PREFERENCE" ->
                    SpicyLevel.NO_PREFERENCE;
            default -> SpicyLevel.UNKNOWN;
        };
    }

    private BoneType mapBoneType(String rawValue) {
        if (isMissing(rawValue)) {
            return null;
        }

        return switch (normalize(rawValue)) {
            case "뼈", "뼈있는", "BONE" ->
                    BoneType.BONE;
            case "순살", "BONELESS" ->
                    BoneType.BONELESS;
            case "상관없음", "선호없음", "NO_PREFERENCE" ->
                    BoneType.NO_PREFERENCE;
            default -> BoneType.UNKNOWN;
        };
    }

    private CupOption mapCupOption(String rawValue) {
        if (isMissing(rawValue)) {
            return null;
        }

        return switch (normalize(rawValue)) {
            case "종이컵", "PAPER" ->
                    CupOption.PAPER;
            case "일반컵", "REGULAR" ->
                    CupOption.REGULAR;
            case "컵없음", "NONE" ->
                    CupOption.NONE;
            case "상관없음", "선호없음", "NO_PREFERENCE" ->
                    CupOption.NO_PREFERENCE;
            default -> CupOption.UNKNOWN;
        };
    }

    private List<AllergenId> mapAllergenIds(
            List<String> rawValues
    ) {
        if (rawValues == null) {
            return null;
        }

        return rawValues.stream()
                .map(this::mapAllergenId)
                .distinct()
                .toList();
    }

    private AllergenId mapAllergenId(String rawValue) {
        return switch (normalize(rawValue)) {
            case "땅콩", "PEANUT" -> AllergenId.PEANUT;
            case "콩", "대두", "SOY" -> AllergenId.SOY;
            case "우유", "유제품", "MILK" -> AllergenId.MILK;
            case "계란", "달걀", "EGG" -> AllergenId.EGG;
            case "밀", "WHEAT" -> AllergenId.WHEAT;
            case "새우", "SHRIMP" -> AllergenId.SHRIMP;
            default -> AllergenId.UNKNOWN;
        };
    }

    private String normalize(String rawValue) {
        return rawValue
                .trim()
                .replaceAll("\\s+", "")
                .toUpperCase(Locale.ROOT);
    }

    private boolean isMissing(String rawValue) {
        return rawValue == null || rawValue.isBlank();
    }
}