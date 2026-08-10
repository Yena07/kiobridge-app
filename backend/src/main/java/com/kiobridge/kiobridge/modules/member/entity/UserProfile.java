package com.kiobridge.kiobridge.modules.member.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;

@Getter
@Entity
@Table(
        name = "user_profiles",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_user_profiles_user_profile",
                        columnNames = {"user_id", "profile_id"}
                )
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private AppUser user;

    @Column(name = "profile_id", nullable = false, length = 100)
    private String profileId;

    @Column(name = "menu_name", nullable = false, length = 100)
    private String menuName;

    @Column(name = "place", nullable = false, length = 50)
    private String place;

    @Column(name = "selections_json", nullable = false, columnDefinition = "text")
    private String selectionsJson;

    @Column(name = "memo", columnDefinition = "text")
    private String memo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UserProfile(
            AppUser user,
            String profileId,
            String menuName,
            String place,
            String selectionsJson,
            String memo
    ) {
        this.user = user;
        this.profileId = profileId;
        this.menuName = menuName;
        this.place = place;
        this.selectionsJson = selectionsJson;
        this.memo = memo;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void update(
            String menuName,
            String place,
            String selectionsJson,
            String memo
    ) {
        this.menuName = menuName;
        this.place = place;
        this.selectionsJson = selectionsJson;
        this.memo = memo;
        this.updatedAt = Instant.now();
    }
}