package com.kiobridge.kiobridge.modules.member.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Getter
@Entity
@Table(
        name = "user_profiles",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_user_profiles_user_profile",
                        columnNames = {
                                "user_id",
                                "profile_id"
                        }
                )
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "user_id",
            nullable = false
    )
    @OnDelete(action = OnDeleteAction.CASCADE)
    private AppUser user;

    @Column(
            name = "profile_id",
            nullable = false,
            length = 100
    )
    private String profileId;

    @Column(
            name = "menu_name",
            nullable = false,
            length = 100
    )
    private String menuName;

    @Column(
            name = "place",
            nullable = false,
            length = 50
    )
    private String place;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(
            name = "selections_json",
            nullable = false
    )
    private Map<String, List<String>> selections;

    @Column(
            name = "memo",
            columnDefinition = "text"
    )
    private String memo;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    public UserProfile(
            AppUser user,
            String profileId,
            String menuName,
            String place,
            Map<String, List<String>> selections,
            String memo
    ) {
        this.user = user;
        this.profileId = profileId;
        this.menuName = menuName;
        this.place = place;
        this.selections = copySelections(selections);
        this.memo = memo;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void update(
            String menuName,
            String place,
            Map<String, List<String>> selections,
            String memo
    ) {
        this.menuName = menuName;
        this.place = place;
        this.selections = copySelections(selections);
        this.memo = memo;
        this.updatedAt = Instant.now();
    }

    private static Map<String, List<String>> copySelections(
            Map<String, List<String>> source
    ) {
        Objects.requireNonNull(
                source,
                "selections는 null일 수 없습니다."
        );

        Map<String, List<String>> copied =
                new LinkedHashMap<>();

        source.forEach((key, values) ->
                copied.put(
                        Objects.requireNonNull(
                                key,
                                "selections 키는 null일 수 없습니다."
                        ),
                        List.copyOf(
                                Objects.requireNonNull(
                                        values,
                                        "selections 값은 null일 수 없습니다."
                                )
                        )
                )
        );

        return copied;
    }
}