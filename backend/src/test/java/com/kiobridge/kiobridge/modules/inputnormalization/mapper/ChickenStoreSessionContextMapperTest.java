package com.kiobridge.kiobridge.modules.inputnormalization.mapper;

import com.kiobridge.kiobridge.contracts.input.context.AllergenId;
import com.kiobridge.kiobridge.contracts.input.context.BoneType;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreCapabilities;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreFacts;
import com.kiobridge.kiobridge.contracts.input.context.CupOption;
import com.kiobridge.kiobridge.contracts.input.context.MetadataSource;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest.CollectionMetadata;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest.ContextInput;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChickenStoreSessionContextMapperTest {

    private final ChickenStoreSessionContextMapper mapper =
            new ChickenStoreSessionContextMapper();

    @Test
    void 한글_주문_입력을_공식_enum으로_변환한다() {
        var context = mapper.toSessionContext(
                createRequest(
                        "포장",
                        "매운맛",
                        "순살",
                        "종이컵",
                        List.of("땅콩")
                )
        );

        assertThat(context.intent().task())
                .isEqualTo(SessionTask.ORDER_FOOD);

        assertThat(context.facts())
                .isEqualTo(new ChickenStoreFacts());

        assertThat(context.capabilities())
                .isEqualTo(new ChickenStoreCapabilities());

        assertThat(context.preferences().serviceType())
                .isEqualTo(ServiceType.TAKE_OUT);

        assertThat(context.preferences().spicyLevel())
                .isEqualTo(SpicyLevel.HOT);

        assertThat(context.preferences().boneType())
                .isEqualTo(BoneType.BONELESS);

        assertThat(context.preferences().cupOption())
                .isEqualTo(CupOption.PAPER);

        assertThat(context.preferences().quantity())
                .isEqualTo(2);

        assertThat(context.hardConstraints().allergenIds())
                .containsExactly(AllergenId.PEANUT);

        assertThat(context.hardConstraints().maxPriceKrw())
                .isEqualByComparingTo("20000");
    }

    @Test
    void fieldMetadata를_공식_JSON_Pointer_경로로_생성한다() {
        var context = mapper.toSessionContext(
                createRequest(
                        "포장",
                        "매운맛",
                        "순살",
                        "종이컵",
                        List.of("땅콩")
                )
        );

        assertThat(context.fieldMetadata())
                .containsKeys(
                        "/preferences/serviceType",
                        "/preferences/spicyLevel",
                        "/preferences/boneType",
                        "/preferences/cupOption",
                        "/preferences/quantity",
                        "/hardConstraints/allergenIds",
                        "/hardConstraints/maxPriceKrw"
                );

        var serviceTypeMetadata =
                context.fieldMetadata()
                        .get("/preferences/serviceType");

        assertThat(serviceTypeMetadata.source())
                .isEqualTo(MetadataSource.WEB_FORM);

        assertThat(serviceTypeMetadata.confidence())
                .isEqualByComparingTo("1.0");

        assertThat(serviceTypeMetadata.confirmedByUser())
                .isTrue();

        assertThat(serviceTypeMetadata.normalizerId())
                .isEqualTo(
                        "chicken-store-context-normalizer-v1"
                );
    }

    @Test
    void 알수없는_알레르기는_UNKNOWN으로_변환한다() {
        var context = mapper.toSessionContext(
                createRequest(
                        "포장",
                        "보통맛",
                        "순살",
                        "일반컵",
                        List.of("갑각류")
                )
        );

        assertThat(
                context.hardConstraints().allergenIds()
        ).containsExactly(AllergenId.UNKNOWN);
    }

    @Test
    void 알레르기는_preferences가_아닌_hardConstraints에_들어간다() {
        var context = mapper.toSessionContext(
                createRequest(
                        "매장",
                        "순한맛",
                        "뼈",
                        "컵 없음",
                        List.of("우유")
                )
        );

        assertThat(
                context.hardConstraints().allergenIds()
        ).containsExactly(AllergenId.MILK);

        assertThat(context.preferences().serviceType())
                .isEqualTo(ServiceType.DINE_IN);

        assertThat(context.preferences().spicyLevel())
                .isEqualTo(SpicyLevel.MILD);

        assertThat(context.preferences().boneType())
                .isEqualTo(BoneType.BONE);

        assertThat(context.preferences().cupOption())
                .isEqualTo(CupOption.NONE);
    }

    @Test
    void 공식_enum_문자열도_그대로_변환한다() {
        var context = mapper.toSessionContext(
                createRequest(
                        "TAKE_OUT",
                        "HOT",
                        "BONELESS",
                        "PAPER",
                        List.of("PEANUT", "MILK")
                )
        );

        assertThat(context.preferences().serviceType())
                .isEqualTo(ServiceType.TAKE_OUT);

        assertThat(context.preferences().spicyLevel())
                .isEqualTo(SpicyLevel.HOT);

        assertThat(context.preferences().boneType())
                .isEqualTo(BoneType.BONELESS);

        assertThat(context.preferences().cupOption())
                .isEqualTo(CupOption.PAPER);

        assertThat(
                context.hardConstraints().allergenIds()
        ).containsExactly(
                AllergenId.PEANUT,
                AllergenId.MILK
        );
    }

    @Test
    void 빈_알레르기_목록은_알레르기_없음으로_유지한다() {
        var context = mapper.toSessionContext(
                createRequest(
                        "포장",
                        "보통맛",
                        "순살",
                        "종이컵",
                        List.of()
                )
        );

        assertThat(
                context.hardConstraints().allergenIds()
        ).isEmpty();

        assertThat(context.fieldMetadata())
                .containsKey(
                        "/hardConstraints/allergenIds"
                );
    }

    private SessionContextNormalizationRequest createRequest(
            String serviceType,
            String spicyLevel,
            String boneType,
            String cupOption,
            List<String> allergenIds
    ) {
        return new SessionContextNormalizationRequest(
                "chicken-store",
                new ContextInput(
                        serviceType,
                        spicyLevel,
                        boneType,
                        cupOption,
                        2,
                        allergenIds,
                        new BigDecimal("20000")
                ),
                new CollectionMetadata(
                        MetadataSource.WEB_FORM,
                        new BigDecimal("1.0"),
                        true,
                        Instant.parse(
                                "2026-08-06T12:00:00Z"
                        )
                )
        );
    }
}