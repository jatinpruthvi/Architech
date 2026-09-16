/**
 * Shared DataTable setup for Residential/Commercial/All property pages.
 */
(function ($) {
    'use strict';

    $(function () {
        if (typeof window.initListingDataTable !== 'function') return;

        var activeFilter = $('#propertyListInitialFilter').val() || 'all';
        var categoryId = $('#propertyListCategoryId').val() || '';
        var categoryName = $('#propertyListCategoryName').val() || '';
        // Property Age is meaningless on a Rent listing; keep it for Sell and
        // for the mixed "All" listing.
        var hidePropertyAge = /rent/i.test(categoryName);
        // Deleted listing (?record=deleted) is a read-only historical view: no
        // quick filter, no search, and no column sorting.
        var isDeletedListing = $('#propertyListDeleted').val() === '1';
        var searchText = '';
        var premiseText = '';
        var $filterSelect = $('#propertyQuickFilter');
        var $search = $('#propertySearchInput');
        var $clear = $('#propertySearchClear');
        var $premise = $('#propertyPremiseInput');
        var $premiseClear = $('#propertyPremiseClear');

        function syncSearchClear() {
            $clear.prop('hidden', !$.trim($search.val()));
        }

        // Select2-style quick filter: Tom Select renders the styled dropdown
        // panel; the wrapper keeps its own border + filter/chevron icons.
        var filterTomSelect = null;
        if (window.TomSelect && $filterSelect.length) {
            filterTomSelect = new TomSelect($filterSelect[0], {
                controlInput: null,
                create: false,
                maxItems: 1,
                allowEmptyOption: true
            });
        }

        function setActiveFilter(nextFilter) {
            activeFilter = nextFilter || 'all';
            if (filterTomSelect) {
                filterTomSelect.setValue(activeFilter, true); // silent: no change event
            } else if ($filterSelect.length) {
                $filterSelect.val(activeFilter);
            }
        }

        // Everything below this call -- the quick-filter change handler and the
        // search box's Enter handler -- is bound after it, so a throw inside the
        // shared init left the page with a working table but a dead filter
        // dropdown and a dead Enter key, and nothing on screen to say why.
        // Recover the instance DataTables already registered so the toolbar keeps
        // working, and let the real error reach the console.
        var table = null;
        try {
            table = window.initListingDataTable({
                selector: '#tblpropertylisting',
                ajaxUrl: 'ajaxpropertydatatable.php',
                pageLength: 25,
                lengthMenu: [[10, 25, 50], [10, 25, 50]],
                attrsIndex: 19,
                fixedColumnsLeft: 1,
                useFixedColumns: false,
                actionWidth: '8.5rem',
                orderableColumns: isDeletedListing ? [] : [3, 8, 14],
                order: isDeletedListing ? [] : [[3, 'desc']],   // latest properties first (Date column)
                columnDefs: [
                    { targets: 1, width: '6.25rem', className: 'dt-note-col' },
                    { targets: 3, width: '5rem' },
                    { targets: 5, width: '17rem' },
                    { targets: 6, width: '10rem' },
                    { targets: 8, width: '6rem' },
                    { targets: 15, width: '8rem' }
                ],
                expandableCols: [5, 12, 13],
                expandableLimit: 90,
                scrollY: 'calc(100vh - 177px)',
                zoomButton: '#dtZoomBtn',
                sidePanel: '#dtSidePanel',
                sideViewButton: '#dtSideBtn',
                infoPanel: true,
                infoSkipCols: [0, 18],
                noteModal: true,
                noteEndpoint: 'ajaxpropnoteupdate.php',
                initialAjaxData: window.TechnoPropertyInitialListingData || null,
                ajaxData: function (data) {
                    data.propertytype = categoryId;
                    data.searchvalue = activeFilter || 'all';
                    data.listingsearch = searchText;
                    data.premise = premiseText;
                }
            });
        } catch (err) {
            if (window.console && window.console.error) {
                window.console.error('Listing table init failed:', err);
            }
            if ($.fn.dataTable && $.fn.dataTable.isDataTable('#tblpropertylisting')) {
                table = $('#tblpropertylisting').DataTable();
            }
        }

        if (hidePropertyAge && table) {
            table.column(11).visible(false, false);   // Property Age
        }

        // The posting date carries no meaning once a property is deleted; the
        // mobile cards already omit it on this listing.
        if (isDeletedListing && table) {
            table.column(3).visible(false, false);   // Date
        }

        setActiveFilter(activeFilter);

        function handleFilterChange(nextFilter) {
            setActiveFilter(nextFilter);
            searchText = '';
            premiseText = '';
            $search.val('');
            $premise.val('');
            syncSearchClear();
            if (table && table.ajax) {
                table.ajax.reload(null, true);
            }
        }

        if (filterTomSelect) {
            filterTomSelect.on('change', function (value) {
                handleFilterChange(value || 'all');
            });
            // The pill's filter icon and chevron sit outside the ts-control, so
            // clicks there wouldn't open Tom Select; toggle it from the wrapper.
            // mousedown (not click): Tom Select closes on document mousedown, so a
            // click-time toggle would re-open right after that close. Acting on
            // mousedown with stopPropagation keeps one gesture = one toggle.
            $filterSelect.parent().on('mousedown', function (event) {
                if ($(event.target).closest('.ts-wrapper').length) return;
                event.preventDefault(); // keep focus on the ts-control (blur closes it)
                event.stopPropagation();
                if (filterTomSelect.isOpen) {
                    filterTomSelect.close();
                } else {
                    filterTomSelect.open();
                    // Focus the control so Tom Select's native outside-mousedown
                    // blur/close path applies to this open too.
                    filterTomSelect.focus();
                }
            });
        } else {
            $filterSelect.on('change', function () {
                handleFilterChange($(this).val() || 'all');
            });
        }

        function reloadTextSearch() {
            searchText = $.trim($search.val());
            syncSearchClear();
            if (table && table.ajax) {
                table.ajax.reload(null, true);
            }
        }

        $search.on('input', syncSearchClear);

        $search.on('keydown', function (event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            reloadTextSearch();
        });

        $clear.on('click', function () {
            $search.val('');
            searchText = '';
            syncSearchClear();
            if (table && table.ajax) {
                table.ajax.reload(null, true);
            }
            $search.trigger('focus');
        });

        $premise.on('keydown', function (event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            premiseText = $.trim($premise.val());
            if (table && table.ajax) {
                table.ajax.reload(null, true);
            }
        });

        $premiseClear.on('click', function () {
            $premise.val('');
            premiseText = '';
            if (table && table.ajax) {
                table.ajax.reload(null, true);
            }
            $premise.trigger('focus');
        });
    });
})(jQuery);
