import { LightningElement, api, track } from 'lwc';
import getRelatedRecords from '@salesforce/apex/RelatedRecordsController.getRelatedRecords';
import { NavigationMixin } from 'lightning/navigation';

export default class RelatedRecordsList extends NavigationMixin(LightningElement) {
    @api recordId;
    @api parentObjectApiName;     // e.g. 'Company__c'
    @api childObjectApiName;      // e.g. 'Product2'
    @api lookupFieldApiName;      // e.g. 'Company__c'
    @api childRelationshipName;   // e.g. 'Products__r'
    @api fieldsList;              // e.g. 'Name,Status__c'
    @api recordLimit = 2;
    @api flexipageId;             // e.g. 'Companies_Record_With_Success_Stories'
    @api cmpId;                   // e.g. 'lst_dynamicRelatedList3'

    @track tableData = [];
    @track error;
    @track isCollapsed = false;   // whether the section is folded

    // Compute the icon name (cannot do ternary inside the template)
    get collapseIconName() {
        return this.isCollapsed 
            ? 'utility:chevronright' 
            : 'utility:chevrondown';
    }

    get fieldsArray() {
        return (this.fieldsList || '')
            .split(',')
            .map(f => f.trim())
            .filter(f => f);
    }
    get firstField() {
        return this.fieldsArray.length > 0 ? this.fieldsArray[0] : null;
    }
    get additionalFields() {
        return this.fieldsArray.length > 1
            ? this.fieldsArray.slice(1)
            : [];
    }

    connectedCallback() {
        this.fetchAllRelatedRecords();
    }

    get cardTitle() {
        if (this.childRelationshipName) {
            return `Related ${this.childRelationshipName.replace(/__r$/, '')}`;
        }
        return 'Related Records';
    }

    get hasRecords() {
        return Array.isArray(this.tableData) && this.tableData.length > 0;
    }

    get noRecordsNoError() {
        return !this.hasRecords && !this.error;
    }

    get displayedData() {
        if (!this.hasRecords) {
            return [];
        }
        return this.tableData.slice(0, this.recordLimit);
    }

    fetchAllRelatedRecords() {
        if (
            !this.recordId ||
            !this.childObjectApiName ||
            !this.lookupFieldApiName ||
            !this.fieldsList
        ) {
            this.error = 'Configuration error: check childObjectApiName, lookupFieldApiName, and fieldsList.';
            this.tableData = [];
            return;
        }

        getRelatedRecords({
            parentId: this.recordId,
            childObjectApiName: this.childObjectApiName,
            lookupFieldApiName: this.lookupFieldApiName,
            fieldsString: this.fieldsList,
            limitSize: 200
        })
        .then(results => {
            const firstFld = this.firstField;
            const addFlds = this.additionalFields;

            this.tableData = results.map(rec => {
                return {
                    Id: rec.Id,
                    title: rec[firstFld],
                    url: '/' + rec.Id,
                    fields: addFlds.map(fld => ({
                        label: this.humanizeLabel(fld),
                        value: rec[fld]
                    }))
                };
            });
            this.error = undefined;
        })
        .catch(err => {
            this.error = err.body && err.body.message
                ? err.body.message
                : JSON.stringify(err);
            this.tableData = [];
        });
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
    }

    handleHeaderClick() {
        // If dynamic-related-list is configured, open that:
        if (this.flexipageId && this.cmpId) {
            const url =
                '/lightning/cmp/force__dynamicRelatedListViewAll' +
                `?force__flexipageId=${this.flexipageId}` +
                `&force__cmpId=${this.cmpId}` +
                `&force__recordId=${this.recordId}`;
            window.open(url, '_self');
            return;
        }
        // Otherwise fall back to standard related-list page:
        this[NavigationMixin.Navigate]({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: this.parentObjectApiName,
                relationshipApiName: this.childRelationshipName,
                actionName: 'view'
            }
        });
    }

    humanizeLabel(apiName) {
        return apiName
            .replace(/__c$|__r$/, '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
}
