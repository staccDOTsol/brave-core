/* Copyright (c) 2020 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

// Brand-specific types and constants for Google Chrome.

#ifndef BRAVE_CHROMIUM_SRC_CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_
#define BRAVE_CHROMIUM_SRC_CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_

#include <stdlib.h>

#include <array>

#include "brave/components/brave_origin/buildflags/buildflags.h"
#include "chrome/app/chrome_dll_resource.h"
#include "chrome/common/chrome_icon_resources_win.h"
#include "chrome/install_static/install_constants.h"

namespace install_static {

// Brand-specific constants and install modes for Brave.

// The brand-specific company name to be included as a component of the install
// and user data directory paths. May be empty if no such dir is to be used.
inline constexpr wchar_t kCompanyPathName[] = L"FairCreators";

// The brand-specific product name to be included as a component of the install
// and user data directory paths.
#if defined(OFFICIAL_BUILD)
#if BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)
// Brave Origin uses "FairCreators-Origin" instead of "FairCreators-Browser" to allow
// side-by-side installation with Brave Browser.
inline constexpr wchar_t kProductPathName[] = L"FairCreators-Origin";
#else
inline constexpr wchar_t kProductPathName[] = L"FairCreators-Browser";
#endif  // BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)
#else
// If you change this, then you also need to change occurrences of this string
// in mini_installer_constants.cc.
inline constexpr wchar_t kProductPathName[] = L"FairCreators-Browser-Development";
#endif

// The brand-specific safe browsing client name.
inline constexpr char kSafeBrowsingName[] = "chromium";

// Note: This list of indices must be kept in sync with the brand-specific
// resource strings in chrome/installer/util/prebuild/create_string_rc.
enum InstallConstantIndex {
#if defined(OFFICIAL_BUILD)
  STABLE_INDEX,
  BETA_INDEX,
  DEV_INDEX,
  NIGHTLY_INDEX,
#else
  DEVELOPER_INDEX,
#endif
  NUM_INSTALL_MODES,
};

#if defined(OFFICIAL_BUILD)

// This is overriding the upstream value and shouldn't be undef'ed
// CHROMIUM_SRC_NOLINT
#define CHROMIUM_INDEX STABLE_INDEX

// Regarding the install switch, use the same values that are in
// chrome/installer/mini_installer/configuration.cc
#if BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)
// Brave Origin uses separate identifiers from Brave Browser to allow
// side-by-side installation and independent update infrastructure.
inline constexpr auto kInstallModes = std::to_array<InstallConstants>({
    // The primary install mode for stable Brave Origin.
    {
        .size = sizeof(InstallConstants),
        .index = STABLE_INDEX,  // The first mode is for stable/beta/dev.
        .install_switch =
            "",  // No install switch for the primary install mode.
        .install_suffix =
            L"",  // Empty install suffix - "Origin" is in kProductPathName.
        .logo_suffix = L"",  // No logo suffix for the primary install mode.
        .app_guid = L"{C24AB54E-6E36-500C-93FD-EBA3FF444776}",
        .base_app_name = L"FairCreators Origin",         // A distinct base_app_name.
        .base_app_id = L"FairCreatorsOrigin",            // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCOHTML",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Origin HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-origin",
        .pdf_prog_id_prefix = L"FCOPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Origin PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{C24AB54E-6E36-500C-93FD-EBA3FF444776}",  // Active Setup GUID.
        .toast_activator_clsid = {0xbfe46e02, 0x599a, 0x5bce,
                                  {0xb1, 0xa6, 0xd8, 0xcb, 0xd6, 0x57, 0xc2, 0x21}},  // Toast activator CLSID.
        .elevator_clsid = {0x1a2b3c4d,
                           0x5e6f,
                           0x7a8b,
                           {0x9c, 0x0d, 0x1e, 0x2f, 0x3a, 0x4b, 0x5c,
                            0x6d}},  // Elevator CLSID.
        .elevator_iid = {0x2b3c4d5e,
                         0x6f7a,
                         0x8b9c,
                         {0x0d, 0x1e, 0x2f, 0x3a, 0x4b, 0x5c, 0x6d, 0x7e}},
        .default_channel_name = L"",  // The empty string means "stable".
        .channel_strategy = ChannelStrategy::FLOATING,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_MAINFRAME,  // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012153-",  // App container sid prefix for sandbox.
    },
    // A secondary install mode for Brave Origin Beta
    {
        .size = sizeof(InstallConstants),
        .index = BETA_INDEX,  // The mode for the side-by-side beta channel.
        .install_switch = "chrome-beta",  // Install switch.
        .install_suffix = L"-Beta",       // Install suffix.
        .logo_suffix = L"Beta",           // Logo suffix.
        .app_guid =
            L"{EB5B0080-FD1E-5508-9CBA-08319E23791B}",  // A distinct app GUID.
        .base_app_name = L"FairCreators Origin Beta",     // A distinct base_app_name.
        .base_app_id = L"FairCreatorsOriginBeta",         // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCOBHTML",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Origin Beta HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-origin-beta",
        .pdf_prog_id_prefix = L"FCOBPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Origin Beta PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{EB5B0080-FD1E-5508-9CBA-08319E23791B}",  // Active Setup GUID.
        .toast_activator_clsid = {0x886b80fd, 0xf08a, 0x56f3,
                                  {0x9c, 0x2b, 0x54, 0xcf, 0x63, 0x84, 0xfb, 0xbb}},  // Toast activator CLSID.
        .elevator_clsid = {0x4d5e6f7a,
                           0x8b9c,
                           0x0d1e,
                           {0x2f, 0x3a, 0x4b, 0x5c, 0x6d, 0x7e, 0x8f,
                            0x9a}},  // Elevator CLSID.
        .elevator_iid = {0x5e6f7a8b,
                         0x9c0d,
                         0x1e2f,
                         {0x3a, 0x4b, 0x5c, 0x6d, 0x7e, 0x8f, 0x9a, 0x0b}},
        .default_channel_name = L"beta",  // Forced channel name.
        .channel_strategy = ChannelStrategy::FIXED,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kBetaApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_X005_BETA,      // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012154-",  // App container sid prefix for sandbox.
    },
    // A secondary install mode for Brave Origin Dev
    {
        .size = sizeof(InstallConstants),
        .index = DEV_INDEX,  // The mode for the side-by-side dev channel.
        .install_switch = "chrome-dev",  // Install switch.
        .install_suffix = L"-Dev",       // Install suffix.
        .logo_suffix = L"Dev",           // Logo suffix.
        .app_guid =
            L"{F31E419F-3AC1-50ED-AD05-85F55DD428BC}",  // A distinct app GUID.
        .base_app_name = L"FairCreators Origin Dev",      // A distinct base_app_name.
        .base_app_id = L"FairCreatorsOriginDev",          // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCODHTML",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Origin Dev HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-origin-dev",
        .pdf_prog_id_prefix = L"FCODPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Origin Dev PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{F31E419F-3AC1-50ED-AD05-85F55DD428BC}",  // Active Setup GUID.
        .toast_activator_clsid = {0x366a283f, 0x9cbd, 0x5c22,
                                  {0xb9, 0xb3, 0x08, 0xe7, 0x22, 0x64, 0xaa, 0x2b}},  // Toast activator CLSID.
        .elevator_clsid = {0x7a8b9c0d,
                           0x1e2f,
                           0x3a4b,
                           {0x5c, 0x6d, 0x7e, 0x8f, 0x9a, 0x0b, 0x1c,
                            0x2d}},  // Elevator CLSID.
        .elevator_iid = {0x8b9c0d1e,
                         0x2f3a,
                         0x4b5c,
                         {0x6d, 0x7e, 0x8f, 0x9a, 0x0b, 0x1c, 0x2d, 0x3e}},
        .default_channel_name = L"dev",  // Forced channel name.
        .channel_strategy = ChannelStrategy::FIXED,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kDevApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_X004_DEV,      // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012155-",  // App container sid prefix for sandbox.
    },
    // A secondary install mode for Brave Origin SxS (nightly).
    {
        .size = sizeof(InstallConstants),
        .index =
            NIGHTLY_INDEX,  // The mode for the side-by-side nightly channel.
        .install_switch = "chrome-sxs",  // Install switch.
        .install_suffix = L"-Nightly",   // Install suffix.
        .logo_suffix = L"Canary",        // Logo suffix.
        .app_guid =
            L"{D1014F0B-8F23-5288-B8D8-1A50B2D5068B}",  // A distinct app GUID.
        .base_app_name = L"FairCreators Origin Nightly",  // A distinct base_app_name.
        .base_app_id = L"FairCreatorsOriginNightly",      // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCOSHTM",   // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Origin Nightly HTML Document",  // Browser ProgID
                                                    // description.
        .direct_launch_url_scheme = "faircreators-origin-nightly",
        .pdf_prog_id_prefix = L"FCOSPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Origin Nightly PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{D1014F0B-8F23-5288-B8D8-1A50B2D5068B}",  // Active Setup GUID.
        .toast_activator_clsid = {0x4f6cbf89, 0x7e61, 0x53ef,
                                  {0xa5, 0x75, 0x1f, 0x04, 0x2c, 0x7d, 0x1f, 0xab}},  // Toast activator CLSID.
        .elevator_clsid = {0x0d1e2f3a,
                           0x4b5c,
                           0x6d7e,
                           {0x8f, 0x9a, 0x0b, 0x1c, 0x2d, 0x3e, 0x4f,
                            0x5a}},  // Elevator CLSID.
        .elevator_iid = {0x1e2f3a4b,
                         0x5c6d,
                         0x7e8f,
                         {0x9a, 0x0b, 0x1c, 0x2d, 0x3e, 0x4f, 0x5a, 0x6b}},
        .default_channel_name = L"nightly",  // Forced channel name.
        .channel_strategy = ChannelStrategy::FIXED,
        .supports_system_level = true,  // Support system-level installs.
        .supports_set_as_default_browser =
            true,  // Support in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kSxSApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_SXS,           // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012156-",  // App container sid prefix for sandbox.
    },
});
#else   // !BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)
inline constexpr auto kInstallModes = std::to_array<InstallConstants>({
    // The primary install mode for stable Brave.
    {
        .size = sizeof(InstallConstants),
        .index = STABLE_INDEX,  // The first mode is for stable/beta/dev.
        .install_switch =
            "",  // No install switch for the primary install mode.
        .install_suffix =
            L"",  // Empty install_suffix for the primary install mode.
        .logo_suffix = L"",  // No logo suffix for the primary install mode.
        .app_guid = L"{B3232963-CEE1-573D-B753-C20DED7621CD}",
        .base_app_name = L"FairCreators",               // A distinct base_app_name.
        .base_app_id = L"FairCreators",                 // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCHTML",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-browser",
        .pdf_prog_id_prefix = L"FCPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{B3232963-CEE1-573D-B753-C20DED7621CD}",  // Active Setup GUID.
        .toast_activator_clsid = {0x5c722d27, 0x9ee1, 0x5ccc,
                                  {0x87, 0x92, 0xe8, 0x08, 0x2e, 0xa9, 0x6b, 0x36}},  // Toast activator CLSID.
        .elevator_clsid = {0x576b31af,
                           0x6369,
                           0x4b6b,
                           {0x85, 0x60, 0xe4, 0xb2, 0x3, 0xa9, 0x7a,
                            0x8b}},  // Elevator CLSID.
        .elevator_iid = {0xf396861e,
                         0x0c8e,
                         0x4c71,
                         {0x82, 0x56, 0x2f, 0xae, 0x6d, 0x75, 0x9c, 0xe9}},
        .default_channel_name = L"",  // The empty string means "stable".
        .channel_strategy = ChannelStrategy::FLOATING,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_MAINFRAME,  // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012149-",  // App container sid prefix for sandbox.
    },
    // A secondary install mode for Brave Beta
    {
        .size = sizeof(InstallConstants),
        .index = BETA_INDEX,  // The mode for the side-by-side beta channel.
        .install_switch = "chrome-beta",  // Install switch.
        .install_suffix = L"-Beta",       // Install suffix.
        .logo_suffix = L"Beta",           // Logo suffix.
        .app_guid =
            L"{B79215D8-7885-5711-A817-DD92706DEBB0}",  // A distinct app GUID.
        .base_app_name = L"FairCreators Beta",           // A distinct base_app_name.
        .base_app_id = L"FairCreatorsBeta",              // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCBHTML",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Beta HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-browser-beta",
        .pdf_prog_id_prefix = L"FCBPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Beta PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{B79215D8-7885-5711-A817-DD92706DEBB0}",  // Active Setup GUID.
        .toast_activator_clsid = {0xd78e2b24, 0xc4b9, 0x5c78,
                                  {0x97, 0x1d, 0x66, 0xa5, 0xb9, 0x9d, 0x04, 0xe8}},  // Toast activator CLSID.
        .elevator_clsid = {0x2313f1cd,
                           0x41f3,
                           0x4347,
                           {0xbe, 0xc0, 0xd7, 0x22, 0xca, 0x41, 0x2c,
                            0x75}},  // Elevator CLSID.
        .elevator_iid = {0x9ebad7ac,
                         0x6e1e,
                         0x4a1c,
                         {0xaa, 0x85, 0x1a, 0x70, 0xca, 0xda, 0x8d, 0x82}},
        .default_channel_name = L"beta",  // Forced channel name.
        .channel_strategy = ChannelStrategy::FIXED,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kBetaApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_X005_BETA,      // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012150-",  // App container sid prefix for sandbox.
    },
    // A secondary install mode for Brave Dev
    {
        .size = sizeof(InstallConstants),
        .index = DEV_INDEX,  // The mode for the side-by-side dev channel.
        .install_switch = "chrome-dev",  // Install switch.
        .install_suffix = L"-Dev",       // Install suffix.
        .logo_suffix = L"Dev",           // Logo suffix.
        .app_guid =
            L"{84A9F9AD-D797-5E2B-B1CC-3AFD62C73C32}",  // A distinct app GUID.
        .base_app_name = L"FairCreators Dev",            // A distinct base_app_name.
        .base_app_id = L"FairCreatorsDev",               // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCDHTML",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Dev HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-browser-dev",
        .pdf_prog_id_prefix = L"FCDPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Dev PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{84A9F9AD-D797-5E2B-B1CC-3AFD62C73C32}",  // Active Setup GUID.
        .toast_activator_clsid = {0xe802fec7, 0xab4e, 0x5f4b,
                                  {0x9b, 0x9f, 0x7e, 0x14, 0xdd, 0x18, 0x9d, 0xfe}},  // Toast activator CLSID.
        .elevator_clsid = {0x9129ed6a,
                           0x11d3,
                           0x43b7,
                           {0xb7, 0x18, 0x8f, 0x82, 0x61, 0x45, 0x97,
                            0xa3}},  // Elevator CLSID.
        .elevator_iid = {0x1e43c77b,
                         0x48e6,
                         0x4a4c,
                         {0x9d, 0xb2, 0xc2, 0x97, 0x17, 0x06, 0xc2, 0x55}},
        .default_channel_name = L"dev",  // Forced channel name.
        .channel_strategy = ChannelStrategy::FIXED,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kDevApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_X004_DEV,      // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012151-",  // App container sid prefix for sandbox.
    },
    // A secondary install mode for Brave SxS (canary).
    {
        .size = sizeof(InstallConstants),
        .index =
            NIGHTLY_INDEX,  // The mode for the side-by-side nightly channel.
        .install_switch = "chrome-sxs",  // Install switch.
        .install_suffix = L"-Nightly",   // Install suffix.
        .logo_suffix = L"Canary",        // Logo suffix.
        .app_guid =
            L"{372F3CB2-3830-52F6-BA0E-674F86F5F3D1}",  // A distinct app GUID.
        .base_app_name = L"FairCreators Nightly",        // A distinct base_app_name.
        .base_app_id = L"FairCreatorsNightly",           // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCSSHTM",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Nightly HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-browser-nightly",
        .pdf_prog_id_prefix = L"FCSSPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Nightly PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{372F3CB2-3830-52F6-BA0E-674F86F5F3D1}",  // Active Setup GUID.
        .toast_activator_clsid = {0xbad41189, 0x00f4, 0x5bc5,
                                  {0xa8, 0xce, 0x3f, 0x6c, 0xb6, 0x37, 0x91, 0x73}},  // Toast activator CLSID.
        .elevator_clsid = {0x1ce2f84f,
                           0x70cb,
                           0x4389,
                           {0x87, 0xdb, 0xd0, 0x99, 0x48, 0x30, 0xbb,
                            0x17}},  // Elevator CLSID.
        .elevator_iid = {0x1db2116f,
                         0x71b7,
                         0x49f0,
                         {0x89, 0x70, 0x33, 0xb1, 0xda, 0xcf, 0xb0, 0x72}},
        .default_channel_name = L"nightly",  // Forced channel name.
        .channel_strategy = ChannelStrategy::FIXED,
        .supports_system_level = true,  // Support system-level installs.
        .supports_set_as_default_browser =
            true,  // Support in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kSxSApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_SXS,           // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012152-",  // App container sid prefix for sandbox.
    },
});
#endif  // BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)
#else

// CHROMIUM_SRC_NOLINT
#define CHROMIUM_INDEX DEVELOPER_INDEX

inline constexpr auto kInstallModes = std::to_array<InstallConstants>({
    // The primary (and only) install mode for Brave developer build.
    {
        .size = sizeof(InstallConstants),
        .index = DEVELOPER_INDEX,  // The one and only mode for developer mode.
        .install_switch =
            "",  // No install switch for the primary install mode.
        .install_suffix =
            L"",  // Empty install_suffix for the primary install mode.
        .logo_suffix = L"",  // No logo suffix for the primary install mode.
        .app_guid =
            L"",  // Empty app_guid since no integraion with Brave Update.
        .base_app_name = L"FairCreators Development",     // A distinct base_app_name.
        .base_app_id = L"FairCreatorsDevelopment",        // A distinct base_app_id.
        .browser_prog_id_prefix = L"FCDevHTM",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"FairCreators Development HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "faircreators-browser-development",
        .pdf_prog_id_prefix = L"FCDevPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"FairCreators Development PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{9A319367-AF5D-555F-8872-3B2DE0DB0474}",  // Active Setup GUID.
        .toast_activator_clsid = {0x7c972248, 0x4586, 0x572b,
                                  {0x95, 0xc1, 0x91, 0x6e, 0x44, 0xf7, 0xe8, 0x3f}},  // Toast activator CLSID.
        .elevator_clsid = {0x5693e62d,
                           0xd6,
                           0x4421,
                           {0xaf, 0xe8, 0x58, 0xf3, 0xc9, 0x47, 0x43,
                            0x6a}},  // Elevator CLSID.
        .elevator_iid = {0x17239bf1,
                         0xa1dc,
                         0x4642,
                         {0x84, 0x6c, 0x1b, 0xac, 0x85, 0xf9, 0x6a, 0x10}},
        .default_channel_name =
            L"",  // Empty default channel name since no update integration.
        .channel_strategy = ChannelStrategy::UNSUPPORTED,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_MAINFRAME,  // App icon resource id.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-"
            L"934012148-",  // App container sid prefix for sandbox.
    },
});
#endif

}  // namespace install_static

#endif  // BRAVE_CHROMIUM_SRC_CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_
