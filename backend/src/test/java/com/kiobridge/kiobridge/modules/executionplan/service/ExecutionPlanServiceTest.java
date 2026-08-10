package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.Action;
import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.ExecutionPlan;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.State;
import com.kiobridge.kiobridge.contracts.UserDecision;
import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.SessionStatusResponse;
import com.kiobridge.kiobridge.contracts.input.context.BoneType;
import com.kiobridge.kiobridge.contracts.input.context.CupOption;
import com.kiobridge.kiobridge.contracts.input.context.FieldMetadata;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SessionIntent;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ExecutionPlanServiceTest {

    private static final String SESSION_ID = "SIM-TEST-001";
    private static final String ENVIRONMENT_ID = "chicken-store";
    private static final String CANDIDATE_ID = "CHICKEN-001";

    @Mock
    private SimulationApiClient simulationApiClient;

    private ExecutionPlanService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new ExecutionPlanService(simulationApiClient);
    }

    @Test
    void approved가_false면_빈_실행계획을_반환하고_외부_호출을_하지_않는다() {
        ExecutionPlan plan = service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.reject("사용자가 거절함"),
            fullPreferenceContext()
        );

        assertThat(plan.actions()).isEmpty();
        assertThat(plan.validationMode()).isEqualTo("SIMULATION_ONLY");
        assertThat(plan.executionEnvironment()).isEqualTo("DIGITAL_TWIN");
        assertThat(plan.actualDeviceCommandSent()).isFalse();
        verifyNoInteractions(simulationApiClient);
    }

    @Test
    void userDecision이_null이면_approved_호출_전에_명시적_예외를_던진다() {
        // CodeRabbit 지적: userDecision.approved()가 null 체크보다 먼저 호출되면
        // 의미 없는 raw NullPointerException이 던져진다. requireNonNull이 먼저 실행돼야 한다.
        assertThatThrownBy(() -> service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            null,
            fullPreferenceContext()
        ))
            .isInstanceOf(NullPointerException.class)
            .hasMessageContaining("userDecision");

        verifyNoInteractions(simulationApiClient);
    }

    @Test
    void approved가_true이고_모든_선호값이_있으면_10개_액션을_순서대로_조립한다() {
        stubValidSession();
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(ExecutionPlanTestFixtures.candidate(CANDIDATE_ID)));

        ExecutionPlan plan = service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            fullPreferenceContext()
        );

        assertThat(plan.actions()).hasSize(10);
        assertActionIndicesAreSequential(plan.actions());

        Action selectService = plan.actions().get(0);
        assertThat(selectService.action()).isEqualTo("select_service");
        assertThat(selectService.target().kind()).isEqualTo("service_type");
        assertThat(selectService.target().id()).isEqualTo("DINE_IN");
        assertThat(selectService.expectedBeforeState()).isEqualTo(State.SERVICE_TYPE);
        assertThat(selectService.expectedAfterState()).isEqualTo(State.MENU_SELECTION);

        Action selectMenu = plan.actions().get(1);
        assertThat(selectMenu.action()).isEqualTo("select_menu");
        assertThat(selectMenu.target().kind()).isEqualTo("candidate");
        assertThat(selectMenu.target().id()).isEqualTo(CANDIDATE_ID);
        assertThat(selectMenu.expectedBeforeState()).isEqualTo(State.MENU_SELECTION);
        assertThat(selectMenu.expectedAfterState()).isEqualTo(State.OPTION_SELECTION);

        Action selectSpicy = plan.actions().get(2);
        assertThat(selectSpicy.action()).isEqualTo("select_option");
        assertThat(selectSpicy.target().kind()).isEqualTo("option");
        assertThat(selectSpicy.target().groupId()).isEqualTo("SPICY_LEVEL");
        assertThat(selectSpicy.target().id()).isEqualTo("HOT");
        assertThat(selectSpicy.expectedBeforeState()).isEqualTo(State.OPTION_SELECTION);
        assertThat(selectSpicy.expectedAfterState()).isEqualTo(State.OPTION_SELECTION);

        Action selectBone = plan.actions().get(3);
        assertThat(selectBone.target().groupId()).isEqualTo("BONE_TYPE");
        assertThat(selectBone.target().id()).isEqualTo("BONE");

        Action selectCup = plan.actions().get(4);
        assertThat(selectCup.target().groupId()).isEqualTo("CUP");
        assertThat(selectCup.target().id()).isEqualTo("PAPER");

        Action selectQuantity = plan.actions().get(5);
        assertThat(selectQuantity.target().groupId()).isEqualTo("QUANTITY");
        assertThat(selectQuantity.target().id()).isEqualTo("Q2");

        Action confirmOption1 = plan.actions().get(6);
        assertThat(confirmOption1.action()).isEqualTo("confirm_option");
        assertThat(confirmOption1.target().kind()).isEqualTo("review");
        assertThat(confirmOption1.target().id()).isEqualTo("OPTION_CONFIRM");
        assertThat(confirmOption1.expectedBeforeState()).isEqualTo(State.OPTION_SELECTION);
        assertThat(confirmOption1.expectedAfterState()).isEqualTo(State.OPTION_CONFIRM);

        Action confirmOption2 = plan.actions().get(7);
        assertThat(confirmOption2.action()).isEqualTo("confirm_option");
        assertThat(confirmOption2.target().id()).isEqualTo("MENU_SELECTION_WITH_CART");
        assertThat(confirmOption2.expectedBeforeState()).isEqualTo(State.OPTION_CONFIRM);
        assertThat(confirmOption2.expectedAfterState()).isEqualTo(State.MENU_SELECTION_WITH_CART);

        Action openCartReview = plan.actions().get(8);
        assertThat(openCartReview.action()).isEqualTo("open_cart_review");
        assertThat(openCartReview.target().kind()).isEqualTo("review");
        assertThat(openCartReview.target().id()).isEqualTo("CART_REVIEW");
        assertThat(openCartReview.expectedBeforeState()).isEqualTo(State.MENU_SELECTION_WITH_CART);
        assertThat(openCartReview.expectedAfterState()).isEqualTo(State.CART_REVIEW);

        Action verifyCart = plan.actions().get(9);
        assertThat(verifyCart.action()).isEqualTo("verify_cart");
        assertThat(verifyCart.target().kind()).isEqualTo("review");
        assertThat(verifyCart.target().id()).isEqualTo("CART_REVIEW");
        assertThat(verifyCart.expectedBeforeState()).isEqualTo(State.CART_REVIEW);
        assertThat(verifyCart.expectedAfterState()).isEqualTo(State.CART_REVIEW);
    }

    @Test
    void CUP_선호가_없으면_9개_액션만_조립하고_CUP_액션은_생략한다() {
        stubValidSession();
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(ExecutionPlanTestFixtures.candidate(CANDIDATE_ID)));

        ExecutionPlan plan = service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            ExecutionPlanTestFixtures.sessionContext(ServiceType.DINE_IN, SpicyLevel.HOT, BoneType.BONE, null, 2)
        );

        assertThat(plan.actions()).hasSize(9);
        assertThat(plan.actions()).noneMatch(a -> "CUP".equals(a.target().groupId()));
        assertActionIndicesAreSequential(plan.actions());
    }

    @Test
    void CUP이_NO_PREFERENCE면_역시_CUP_액션을_생략한다() {
        stubValidSession();
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(ExecutionPlanTestFixtures.candidate(CANDIDATE_ID)));

        ExecutionPlan plan = service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            ExecutionPlanTestFixtures.sessionContext(
                ServiceType.DINE_IN, SpicyLevel.HOT, BoneType.BONE, CupOption.NO_PREFERENCE, 2
            )
        );

        assertThat(plan.actions()).hasSize(9);
        assertThat(plan.actions()).noneMatch(a -> "CUP".equals(a.target().groupId()));
    }

    @Test
    void 추천된_후보가_사용자_선호값을_지원하지_않으면_후보가_지원하는_값으로_대체한다() {
        // 실제 candidates.json처럼 SPICY_LEVEL을 MILD 하나만 지원하는 후보. 사용자 선호는 HOT이지만
        // (fullPreferenceContext()) 이 후보가 지원하지 않는 옵션을 실행계획에 넣으면 안 된다.
        stubValidSession();
        Candidate narrowCandidate = ExecutionPlanTestFixtures.candidate(CANDIDATE_ID, Map.of(
            "SERVICE_TYPE", List.of("DINE_IN", "TAKE_OUT"),
            "SPICY_LEVEL", List.of("MILD"),
            "BONE_TYPE", List.of("BONE", "BONELESS"),
            "CUP", List.of("PAPER", "REGULAR"),
            "QUANTITY", List.of("Q1", "Q2", "Q3")
        ));
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(narrowCandidate));

        ExecutionPlan plan = service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            fullPreferenceContext()
        );

        Action selectSpicy = plan.actions().stream()
            .filter(a -> "SPICY_LEVEL".equals(a.target().groupId()))
            .findFirst()
            .orElseThrow();
        assertThat(selectSpicy.target().id()).isEqualTo("MILD");
    }

    @Test
    void 추천된_candidateId가_없으면_예외를_던지고_세션_조회조차_하지_않는다() {
        assertThatThrownBy(() -> service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(null),
            UserDecision.approve(),
            fullPreferenceContext()
        )).isInstanceOf(IllegalStateException.class);

        verify(simulationApiClient, never()).getSession(any());
        verify(simulationApiClient, never()).getFixture(any());
    }

    @Test
    void 추천된_candidate가_fixture에_없으면_예외를_던진다() {
        stubValidSession();
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(ExecutionPlanTestFixtures.candidate("CHICKEN-999")));

        assertThatThrownBy(() -> service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            fullPreferenceContext()
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void chickenStore가_아닌_sessionContext면_예외를_던진다() {
        stubValidSession();
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(ExecutionPlanTestFixtures.candidate(CANDIDATE_ID)));

        assertThatThrownBy(() -> service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            nonChickenStoreContext()
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 세션의_environmentId가_비어있으면_예외를_던지고_fixture를_조회하지_않는다() {
        when(simulationApiClient.getSession(SESSION_ID))
            .thenReturn(new SessionStatusResponse(SESSION_ID, null, "WAITING", "NOT_STARTED", "NOT_STARTED"));

        assertThatThrownBy(() -> service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            fullPreferenceContext()
        )).isInstanceOf(IllegalStateException.class);

        verify(simulationApiClient, never()).getFixture(any());
    }

    @Test
    void environmentId는_요청이_아니라_세션_조회_결과로_결정된다() {
        // 클라이언트가 (있지도 않은) environmentId를 따로 안 보내도, sessionId만으로
        // Simulation API에 조회해서 environmentId를 얻어 그걸로 getFixture를 호출해야 한다.
        stubValidSession();
        when(simulationApiClient.getFixture(ENVIRONMENT_ID))
            .thenReturn(ExecutionPlanTestFixtures.fixture(ExecutionPlanTestFixtures.candidate(CANDIDATE_ID)));

        service.buildExecutionPlan(
            SESSION_ID,
            ExecutionPlanTestFixtures.recommendation(CANDIDATE_ID),
            UserDecision.approve(),
            fullPreferenceContext()
        );

        verify(simulationApiClient).getSession(SESSION_ID);
        verify(simulationApiClient).getFixture(ENVIRONMENT_ID);
    }

    private void stubValidSession() {
        when(simulationApiClient.getSession(SESSION_ID))
            .thenReturn(new SessionStatusResponse(SESSION_ID, ENVIRONMENT_ID, "WAITING", "NOT_STARTED", "NOT_STARTED"));
    }

    private static void assertActionIndicesAreSequential(java.util.List<Action> actions) {
        for (int i = 0; i < actions.size(); i++) {
            assertThat(actions.get(i).actionIndex()).isEqualTo(i);
        }
    }

    private static com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext fullPreferenceContext() {
        return ExecutionPlanTestFixtures.sessionContext(
            ServiceType.DINE_IN, SpicyLevel.HOT, BoneType.BONE, CupOption.PAPER, 2
        );
    }

    /** SessionContextBase만 구현하고 preferences()가 ChickenStorePreferences가 아닌 다른 타입을 돌려주는 가짜. */
    private static SessionContextBase<Object, Object, Object, Object> nonChickenStoreContext() {
        return new SessionContextBase<>() {
            @Override
            public SessionIntent intent() {
                return new SessionIntent(SessionTask.ORDER_FOOD);
            }

            @Override
            public Object facts() {
                return new Object();
            }

            @Override
            public Object preferences() {
                return "not-a-chicken-store-preferences";
            }

            @Override
            public Object hardConstraints() {
                return new Object();
            }

            @Override
            public Object capabilities() {
                return new Object();
            }

            @Override
            public Map<String, FieldMetadata> fieldMetadata() {
                return Map.of();
            }
        };
    }
}
